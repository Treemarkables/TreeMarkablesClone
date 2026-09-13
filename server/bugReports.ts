// ============================================================================
// In-app bug / feedback reports.
//
// Any signed-in member can file a report from anywhere in the app: text, a voice
// note (transcribed with Whisper), photos and a video. The client creates a draft,
// streams each attachment to its own endpoint, then calls /submit which flips the
// report to `open` and alerts the platform operator (bell + email).
//
// Tenancy: the JSON routes run inside the request's ALS tenant context, but every
// read/write here still filters on the session's businessId explicitly so the
// routes are correct whether or not RLS is enabled. The multer routes lose the
// ALS context (see PR #380) — they read the parent report on the owner connection
// with an explicit ownership check and stamp the attachment insert from it.
// ============================================================================
import type { Express, Request, Response, NextFunction } from "express";
import type { Multer } from "multer";
import fs from "fs";
import OpenAI from "openai";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { ownerDb } from "./db";
import { storage } from "./storage";
import { runWithBusiness } from "./tenancy/tenantStore";
import { PhotoStorageService } from "./photoStorage";
import { emailService } from "./services/emailService";
import { APP_URL } from "./config/appUrl";
import { TREEMARKABLES_BUSINESS_IDS } from "../shared/roleChecklistAccess";

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

interface Deps {
  requireSession: Middleware;
  requirePlatformAdmin: Middleware;
  // Existing multer instances from routes.ts — memory (photos), GCS stream (video), disk (audio).
  imageUpload: Multer;
  videoUpload: Multer;
  audioUpload: Multer;
}

const ALERT_EMAIL = (process.env.BUG_REPORT_ALERT_EMAIL || "accounts@treemarkables.nz").trim();
const MAX_DESCRIPTION = 20_000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function str(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function isSeverity(v: unknown): v is schema.BugReportSeverity {
  return typeof v === "string" && (schema.bugReportSeverities as readonly string[]).includes(v);
}

function isStatus(v: unknown): v is schema.BugReportStatus {
  return typeof v === "string" && (schema.bugReportStatuses as readonly string[]).includes(v);
}

// Owner-connection read of a report the session user is allowed to touch: it must
// belong to the session tenant AND (for non-admins) be their own.
async function loadOwnReport(req: Request): Promise<schema.BugReport | null> {
  const employeeId = req.session.employeeId;
  const businessId = req.session.businessId;
  if (!employeeId || !businessId) return null;
  const [report] = await ownerDb
    .select()
    .from(schema.bugReports)
    .where(and(eq(schema.bugReports.id, req.params.id), eq(schema.bugReports.businessId, businessId)))
    .limit(1);
  if (!report) return null;
  if (report.reporterEmployeeId !== employeeId) {
    const employee = await storage.getEmployee(employeeId);
    if (employee?.role !== "admin") return null;
  }
  return report;
}

async function operatorBusinessId(): Promise<string | null> {
  const rows = await ownerDb
    .select({ id: schema.businesses.id })
    .from(schema.businesses)
    .where(inArray(schema.businesses.id, [...TREEMARKABLES_BUSINESS_IDS]))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function transcribeVoiceNote(filePath: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en",
      prompt:
        "A user of a New Zealand field-service app is describing a bug or problem they hit in the app: what they tapped, what they expected, and what happened instead.",
    });
    const text = typeof transcription === "string" ? transcription : transcription.text;
    return text?.trim() || null;
  } catch (err) {
    console.error("[bug-reports] transcription failed:", err);
    return null;
  }
}

async function alertOperator(report: schema.BugReport): Promise<void> {
  const [reporter, business, attachments] = await Promise.all([
    storage.getEmployee(report.reporterEmployeeId),
    report.businessId ? storage.getBusinessById(report.businessId) : Promise.resolve(undefined),
    ownerDb.select().from(schema.bugReportAttachments).where(eq(schema.bugReportAttachments.reportId, report.id)),
  ]);
  const who = [reporter?.firstName, reporter?.lastName].filter(Boolean).join(" ") || "A member";
  const where = business?.name ? ` (${business.name})` : "";
  const summary = report.title || report.description.slice(0, 80) || report.transcript?.slice(0, 80) || "(no text)";
  const counts = { photo: 0, video: 0, audio: 0 } as Record<string, number>;
  for (const a of attachments) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  const media = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`)
    .join(", ");
  const link = `${APP_URL}/admin/bug-reports?id=${report.id}`;

  // Bell alert in the operator tenant. Best-effort — never block the submit.
  try {
    const opBiz = await operatorBusinessId();
    if (opBiz) {
      await runWithBusiness(opBiz, () =>
        storage.createNotification({
          title: `Bug report: ${summary}`,
          message: `${who}${where} reported a ${report.severity}${media ? ` with ${media}` : ""}.`,
          type: "system_alert",
          priority: report.severity === "blocker" ? "high" : "medium",
          actionUrl: `/admin/bug-reports?id=${report.id}`,
          metadata: { bugReportId: report.id, reporterBusinessId: report.businessId, severity: report.severity },
        }),
      );
    }
  } catch (err) {
    console.error("[bug-reports] bell alert failed:", err);
  }

  try {
    const body = report.description || report.transcript || "";
    const text =
      `${who}${where} filed a ${report.severity} bug report.\n\n` +
      `${body}\n\n` +
      (report.transcript && report.description ? `Voice note transcript:\n${report.transcript}\n\n` : "") +
      (media ? `Attachments: ${media}\n` : "") +
      `Page: ${report.pageUrl || "-"}\nPlatform: ${report.platform || "-"} ${report.screenSize || ""}\n` +
      `Device: ${report.userAgent || "-"}\n\nOpen: ${link}`;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const html =
      `<p><strong>${esc(who)}</strong>${esc(where)} filed a <strong>${esc(report.severity)}</strong> bug report.</p>` +
      `<p>${esc(body)}</p>` +
      (report.transcript && report.description ? `<p><em>Voice note transcript:</em><br>${esc(report.transcript)}</p>` : "") +
      (media ? `<p>Attachments: ${esc(media)}</p>` : "") +
      `<p style="color:#666;font-size:13px">Page: ${esc(report.pageUrl || "-")}<br>Platform: ${esc(report.platform || "-")} ${esc(report.screenSize || "")}<br>Device: ${esc(report.userAgent || "-")}</p>` +
      `<p><a href="${link}">Open in the concierge view</a></p>`;
    await emailService.sendEmail({
      to: ALERT_EMAIL,
      subject: `[Bug report] ${report.severity}: ${summary}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[bug-reports] alert email failed:", err);
  }
}

export function registerBugReportRoutes(app: Express, deps: Deps): void {
  const { requireSession, requirePlatformAdmin, imageUpload, videoUpload, audioUpload } = deps;
  const photoStorage = new PhotoStorageService();

  // Create a draft. Attachments and /submit follow.
  app.post("/api/bug-reports", requireSession, async (req: Request, res: Response) => {
    try {
      const employeeId = req.session.employeeId!;
      const businessId = req.session.businessId;
      if (!businessId) return res.status(403).json({ success: false, message: "No business on session" });
      const b = req.body ?? {};
      const [report] = await ownerDb
        .insert(schema.bugReports)
        .values({
          businessId,
          reporterEmployeeId: employeeId,
          status: "draft",
          severity: isSeverity(b.severity) ? b.severity : "minor",
          title: str(b.title, 200),
          description: str(b.description, MAX_DESCRIPTION) ?? "",
          pageUrl: str(b.pageUrl, 2000),
          userAgent: str(req.headers["user-agent"], 1000),
          platform: str(b.platform, 20),
          screenSize: str(b.screenSize, 40),
          appBuild: str(b.appBuild, 100),
          extraContext: b.extraContext && typeof b.extraContext === "object" ? b.extraContext : null,
        })
        .returning();
      res.json({ success: true, data: report });
    } catch (error) {
      console.error("[bug-reports] create failed:", error);
      res.status(500).json({ success: false, message: "Failed to create report" });
    }
  });

  // Reporter's own reports (and, for tenant admins, the whole tenant's) — newest first.
  app.get("/api/bug-reports/mine", requireSession, async (req: Request, res: Response) => {
    try {
      const employeeId = req.session.employeeId!;
      const businessId = req.session.businessId;
      if (!businessId) return res.json({ success: true, data: [] });
      const employee = await storage.getEmployee(employeeId);
      const scope = employee?.role === "admin"
        ? eq(schema.bugReports.businessId, businessId)
        : and(eq(schema.bugReports.businessId, businessId), eq(schema.bugReports.reporterEmployeeId, employeeId));
      const rows = await ownerDb
        .select()
        .from(schema.bugReports)
        .where(and(scope, sql`${schema.bugReports.status} <> 'draft'`))
        .orderBy(desc(schema.bugReports.createdAt))
        .limit(50);
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error("[bug-reports] list mine failed:", error);
      res.status(500).json({ success: false, message: "Failed to load reports" });
    }
  });

  // Photo — memory multer → GCS via the photo pipeline (HEIC conversion + thumbnail).
  app.post("/api/bug-reports/:id/photos", requireSession, imageUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const report = await loadOwnReport(req);
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      const file = req.file;
      if (!file?.buffer) return res.status(400).json({ success: false, message: "No file" });
      if (!file.mimetype.startsWith("image/")) return res.status(400).json({ success: false, message: "Not an image" });
      const { url, thumbnailUrl } = await photoStorage.uploadPhoto(file.buffer, file.originalname, file.mimetype);
      const [row] = await ownerDb
        .insert(schema.bugReportAttachments)
        .values({
          businessId: report.businessId,
          reportId: report.id,
          kind: "photo",
          url,
          thumbnailUrl,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname,
        })
        .returning();
      res.json({ success: true, data: row });
    } catch (error) {
      console.error("[bug-reports] photo upload failed:", error);
      res.status(500).json({ success: false, message: "Photo upload failed" });
    }
  });

  // Video — the GCS streaming engine already wrote the object; req.file.path is its URL.
  app.post("/api/bug-reports/:id/videos", requireSession, videoUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const report = await loadOwnReport(req);
      const file = req.file;
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      if (!file?.path) return res.status(400).json({ success: false, message: "No file" });
      const [row] = await ownerDb
        .insert(schema.bugReportAttachments)
        .values({
          businessId: report.businessId,
          reportId: report.id,
          kind: "video",
          url: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname,
        })
        .returning();
      res.json({ success: true, data: row });
    } catch (error) {
      console.error("[bug-reports] video upload failed:", error);
      res.status(500).json({ success: false, message: "Video upload failed" });
    }
  });

  // Voice note — disk multer → GCS (document path, served with its audio content
  // type) + Whisper transcript appended to the report.
  app.post("/api/bug-reports/:id/voice", requireSession, audioUpload.single("file"), async (req: Request, res: Response) => {
    const tmp = req.file?.path;
    try {
      const report = await loadOwnReport(req);
      const file = req.file;
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      if (!file?.path) return res.status(400).json({ success: false, message: "No file" });
      const buffer = fs.readFileSync(file.path);
      const ext = (file.filename.split(".").pop() || "m4a").toLowerCase();
      const { url } = await photoStorage.uploadDocument(buffer, `voice-note.${ext}`, file.mimetype);
      const transcript = await transcribeVoiceNote(file.path);
      const [row] = await ownerDb
        .insert(schema.bugReportAttachments)
        .values({
          businessId: report.businessId,
          reportId: report.id,
          kind: "audio",
          url,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname || `voice-note.${ext}`,
        })
        .returning();
      if (transcript) {
        const merged = report.transcript ? `${report.transcript}\n\n${transcript}` : transcript;
        await ownerDb
          .update(schema.bugReports)
          .set({ transcript: merged, updatedAt: new Date() })
          .where(eq(schema.bugReports.id, report.id));
      }
      res.json({ success: true, data: { attachment: row, transcript } });
    } catch (error) {
      console.error("[bug-reports] voice upload failed:", error);
      res.status(500).json({ success: false, message: "Voice note upload failed" });
    } finally {
      if (tmp) fs.promises.unlink(tmp).catch(() => undefined);
    }
  });

  // Finalise: draft → open, alert the operator.
  app.post("/api/bug-reports/:id/submit", requireSession, async (req: Request, res: Response) => {
    try {
      const report = await loadOwnReport(req);
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      const b = req.body ?? {};
      const [updated] = await ownerDb
        .update(schema.bugReports)
        .set({
          status: report.status === "draft" ? "open" : report.status,
          severity: isSeverity(b.severity) ? b.severity : report.severity,
          title: str(b.title, 200) ?? report.title,
          description: str(b.description, MAX_DESCRIPTION) ?? report.description,
          submittedAt: report.submittedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.bugReports.id, report.id))
        .returning();
      if (report.status === "draft") {
        // fire-and-forget; the reporter shouldn't wait on Resend
        void alertOperator(updated);
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("[bug-reports] submit failed:", error);
      res.status(500).json({ success: false, message: "Failed to submit report" });
    }
  });

  // Abandoned draft — the reporter closed the modal without submitting.
  app.delete("/api/bug-reports/:id", requireSession, async (req: Request, res: Response) => {
    try {
      const report = await loadOwnReport(req);
      if (!report) return res.status(404).json({ success: false, message: "Report not found" });
      if (report.status !== "draft") return res.status(400).json({ success: false, message: "Only drafts can be deleted" });
      await ownerDb.delete(schema.bugReports).where(eq(schema.bugReports.id, report.id));
      res.json({ success: true });
    } catch (error) {
      console.error("[bug-reports] delete failed:", error);
      res.status(500).json({ success: false, message: "Failed to delete report" });
    }
  });

  // ── Platform operator (cross-tenant) ─────────────────────────────────────
  app.get("/api/admin/bug-reports", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "";
      const where = status && isStatus(status)
        ? eq(schema.bugReports.status, status)
        : sql`${schema.bugReports.status} <> 'draft'`;
      const rows = await ownerDb
        .select({
          report: schema.bugReports,
          businessName: schema.businesses.name,
          reporterFirstName: schema.employees.firstName,
          reporterLastName: schema.employees.lastName,
          reporterEmail: schema.employees.email,
          attachmentCount: sql<number>`(SELECT count(*)::int FROM bug_report_attachments a WHERE a.report_id = ${schema.bugReports.id})`,
        })
        .from(schema.bugReports)
        .leftJoin(schema.businesses, eq(schema.businesses.id, schema.bugReports.businessId))
        .leftJoin(schema.employees, eq(schema.employees.id, schema.bugReports.reporterEmployeeId))
        .where(where)
        .orderBy(desc(schema.bugReports.createdAt))
        .limit(200);
      res.json({
        success: true,
        data: rows.map((r) => ({
          ...r.report,
          businessName: r.businessName,
          reporterName: [r.reporterFirstName, r.reporterLastName].filter(Boolean).join(" "),
          reporterEmail: r.reporterEmail,
          attachmentCount: r.attachmentCount,
        })),
      });
    } catch (error) {
      console.error("[bug-reports] admin list failed:", error);
      res.status(500).json({ success: false, message: "Failed to load reports" });
    }
  });

  app.get("/api/admin/bug-reports/:id", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const [row] = await ownerDb
        .select({
          report: schema.bugReports,
          businessName: schema.businesses.name,
          reporterFirstName: schema.employees.firstName,
          reporterLastName: schema.employees.lastName,
          reporterEmail: schema.employees.email,
        })
        .from(schema.bugReports)
        .leftJoin(schema.businesses, eq(schema.businesses.id, schema.bugReports.businessId))
        .leftJoin(schema.employees, eq(schema.employees.id, schema.bugReports.reporterEmployeeId))
        .where(eq(schema.bugReports.id, req.params.id))
        .limit(1);
      if (!row) return res.status(404).json({ success: false, message: "Report not found" });
      const attachments = await ownerDb
        .select()
        .from(schema.bugReportAttachments)
        .where(eq(schema.bugReportAttachments.reportId, row.report.id))
        .orderBy(schema.bugReportAttachments.createdAt);
      res.json({
        success: true,
        data: {
          ...row.report,
          businessName: row.businessName,
          reporterName: [row.reporterFirstName, row.reporterLastName].filter(Boolean).join(" "),
          reporterEmail: row.reporterEmail,
          attachments,
        },
      });
    } catch (error) {
      console.error("[bug-reports] admin get failed:", error);
      res.status(500).json({ success: false, message: "Failed to load report" });
    }
  });

  app.patch("/api/admin/bug-reports/:id", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const b = req.body ?? {};
      const set: Partial<schema.BugReport> = { updatedAt: new Date() };
      if (isStatus(b.status)) {
        set.status = b.status;
        if (b.status === "resolved" || b.status === "closed") set.resolvedAt = new Date();
      }
      if (isSeverity(b.severity)) set.severity = b.severity;
      if (typeof b.operatorNotes === "string") set.operatorNotes = b.operatorNotes.slice(0, MAX_DESCRIPTION);
      const [updated] = await ownerDb
        .update(schema.bugReports)
        .set(set)
        .where(eq(schema.bugReports.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ success: false, message: "Report not found" });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("[bug-reports] admin update failed:", error);
      res.status(500).json({ success: false, message: "Failed to update report" });
    }
  });
}
