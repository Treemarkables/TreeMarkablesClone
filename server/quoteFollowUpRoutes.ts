/**
 * Session routes for the quote follow-up queue.
 * Approve & Send posts { confirm: true }. Any other body does not send.
 */
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { currentBusinessId } from "./tenancy/tenantStore";
import {
  approveQuoteFollowUp,
  dismissQuoteFollowUp,
  httpStatus,
  listQuoteFollowUpsForSession,
  snoozeQuoteFollowUp,
  updateQuoteFollowUpDraft,
} from "./quoteFollowUpService";
import { countWaitingInvoiceXeroFollowUps } from "./invoiceXeroService";

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

async function authorName(req: Request): Promise<string> {
  try {
    const employee = req.session.employeeId ? await storage.getEmployee(req.session.employeeId) : undefined;
    const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(" ");
    return name || "Staff";
  } catch {
    return "Staff";
  }
}

export function registerQuoteFollowUpRoutes(app: Express): void {
  app.get("/api/quote-follow-ups/count", async (req: Request, res: Response) => {
    try {
      if (!businessId(req, res)) return;
      const list = await listQuoteFollowUpsForSession();
      const invoicesNotInXero = await countWaitingInvoiceXeroFollowUps();
      res.json({
        success: true,
        data: {
          count: list.waiting + invoicesNotInXero,
          quotes: list.waiting,
          invoicesNotInXero,
        },
      });
    } catch (error) {
      console.error("Error counting quote follow-ups:", error);
      res.status(httpStatus(error)).json({ success: false, message: "Couldn't load follow-ups." });
    }
  });

  app.get("/api/quote-follow-ups", async (req: Request, res: Response) => {
    try {
      if (!businessId(req, res)) return;
      const list = await listQuoteFollowUpsForSession();
      res.json({ success: true, data: list });
    } catch (error) {
      console.error("Error listing quote follow-ups:", error);
      res.status(httpStatus(error)).json({ success: false, message: "Couldn't load follow-ups." });
    }
  });

  app.patch("/api/quote-follow-ups/:id", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const updated = await updateQuoteFollowUpDraft(id, req.params.id, req.body ?? {});
      if (!updated) return res.status(404).json({ success: false, message: "Follow-up not found." });
      res.json({ success: true, data: updated });
    } catch (error) {
      const status = httpStatus(error);
      if (status >= 500) console.error("Error editing quote follow-up:", error);
      const message = error instanceof Error ? error.message : "Couldn't save the follow-up.";
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/quote-follow-ups/:id/approve", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const result = await approveQuoteFollowUp({
        businessId: id,
        id: req.params.id,
        confirm: req.body?.confirm,
        authorName: await authorName(req),
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error approving quote follow-up:", error);
      res.status(500).json({ success: false, message: "Couldn't send the follow-up. Nothing was marked as sent." });
    }
  });

  app.post("/api/quote-follow-ups/:id/snooze", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const days = Number(req.body?.days);
      const updated = await snoozeQuoteFollowUp(id, req.params.id, days);
      if (!updated) return res.status(404).json({ success: false, message: "Follow-up not found." });
      res.json({ success: true, data: updated });
    } catch (error) {
      const status = httpStatus(error);
      if (status >= 500) console.error("Error snoozing quote follow-up:", error);
      const message = error instanceof Error ? error.message : "Couldn't snooze the follow-up.";
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/quote-follow-ups/:id/dismiss", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const ok = await dismissQuoteFollowUp(id, req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: "Follow-up not found." });
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing quote follow-up:", error);
      res.status(500).json({ success: false, message: "Couldn't mark the quote as lost." });
    }
  });
}
