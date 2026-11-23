/**
 * Session routes for completed jobs that are not billed.
 * Approve posts { confirm: true }. Any other body does not create or send.
 */
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { currentBusinessId } from "./tenancy/tenantStore";
import {
  approveJobNotBilled,
  dismissJobNotBilled,
  listJobsNotBilledForSession,
  snoozeJobNotBilled,
  updateJobNotBilledDraft,
} from "./jobsNotBilledService";

function businessId(req: Request, res: Response): string | null {
  if (!req.session.employeeId) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return null;
  }
  const id = currentBusinessId();
  if (!id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return null;
  }
  return id;
}

function httpStatus(error: unknown): number {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" ? status : 500;
}

async function authorName(req: Request): Promise<string> {
  try {
    const employee = req.session.employeeId ? await storage.getEmployee(req.session.employeeId) : undefined;
    const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
    return name || "Staff";
  } catch {
    return "Staff";
  }
}

export function registerJobsNotBilledRoutes(app: Express): void {
  app.get("/api/job-billing-follow-ups", async (req: Request, res: Response) => {
    try {
      if (!businessId(req, res)) return;
      const list = await listJobsNotBilledForSession();
      res.json({ success: true, data: list });
    } catch (error) {
      console.error("Error listing jobs not billed:", error);
      res.status(httpStatus(error)).json({ success: false, message: "Couldn't load jobs not billed." });
    }
  });

  app.patch("/api/job-billing-follow-ups/:id", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const updated = await updateJobNotBilledDraft(id, req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ success: false, message: "Job not found in the queue." });
      res.json({ success: true, data: updated });
    } catch (error) {
      const status = httpStatus(error);
      if (status >= 500) console.error("Error editing job not billed:", error);
      const message = error instanceof Error ? error.message : "Couldn't save the draft.";
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/job-billing-follow-ups/:id/approve", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      if (req.body?.confirm !== true) {
        res.status(400).json({ success: false, message: "This needs confirm: true. Nothing was created or sent." });
        return;
      }
      const result = await approveJobNotBilled({
        businessId: id,
        id: req.params.id,
        confirm: true,
        authorName: await authorName(req),
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error approving job not billed:", error);
      res.status(500).json({ success: false, message: "Couldn't do that. Nothing was marked as done." });
    }
  });

  app.post("/api/job-billing-follow-ups/:id/snooze", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const updated = await snoozeJobNotBilled(id, req.params.id, Number(req.body?.days));
      if (!updated) return res.status(404).json({ success: false, message: "Job not found in the queue." });
      res.json({ success: true, data: updated });
    } catch (error) {
      const status = httpStatus(error);
      if (status >= 500) console.error("Error snoozing job not billed:", error);
      const message = error instanceof Error ? error.message : "Couldn't snooze this job.";
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/job-billing-follow-ups/:id/dismiss", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const ok = await dismissJobNotBilled(id, req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: "Job not found in the queue." });
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing job not billed:", error);
      res.status(500).json({ success: false, message: "Couldn't dismiss this job." });
    }
  });
}
