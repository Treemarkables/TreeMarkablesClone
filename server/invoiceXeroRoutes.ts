/**
 * Session routes for invoices that are not in Xero.
 * Approve & Sync posts { confirm: true }. Any other body does not call Xero.
 * Sync is admin-only, matching the Invoices page send.
 */
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { currentBusinessId } from "./tenancy/tenantStore";
import {
  approveInvoiceXeroFollowUp,
  dismissInvoiceXeroFollowUp,
  listInvoiceXeroForSession,
  snoozeInvoiceXeroFollowUp,
} from "./invoiceXeroService";

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

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  try {
    const employee = req.session.employeeId ? await storage.getEmployee(req.session.employeeId) : undefined;
    if (!employee || employee.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return false;
    }
    return true;
  } catch {
    res.status(403).json({ success: false, message: "Admin access required" });
    return false;
  }
}

export function registerInvoiceXeroRoutes(app: Express): void {
  app.get("/api/invoice-xero-follow-ups", async (req: Request, res: Response) => {
    try {
      if (!businessId(req, res)) return;
      const list = await listInvoiceXeroForSession();
      res.json({ success: true, data: list });
    } catch (error) {
      console.error("Error listing invoices not in Xero:", error);
      res.status(httpStatus(error)).json({ success: false, message: "Couldn't load invoices not in Xero." });
    }
  });

  app.post("/api/invoice-xero-follow-ups/:id/sync", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      if (req.body?.confirm !== true) {
        res.status(400).json({ success: false, message: "Syncing needs confirm: true. Nothing was sent to Xero." });
        return;
      }
      if (!(await requireAdmin(req, res))) return;
      const result = await approveInvoiceXeroFollowUp({
        businessId: id,
        id: req.params.id,
        confirm: true,
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error syncing invoice to Xero:", error);
      res.status(500).json({ success: false, message: "Couldn't sync to Xero. Nothing was marked as synced." });
    }
  });

  app.post("/api/invoice-xero-follow-ups/:id/snooze", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const updated = await snoozeInvoiceXeroFollowUp(id, req.params.id, Number(req.body?.days));
      if (!updated) return res.status(404).json({ success: false, message: "Invoice not found in the queue." });
      res.json({ success: true, data: updated });
    } catch (error) {
      const status = httpStatus(error);
      if (status >= 500) console.error("Error snoozing invoice Xero follow-up:", error);
      const message = error instanceof Error ? error.message : "Couldn't snooze this invoice.";
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/invoice-xero-follow-ups/:id/dismiss", async (req: Request, res: Response) => {
    try {
      const id = businessId(req, res);
      if (!id) return;
      const ok = await dismissInvoiceXeroFollowUp(id, req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: "Invoice not found in the queue." });
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing invoice Xero follow-up:", error);
      res.status(500).json({ success: false, message: "Couldn't dismiss this invoice." });
    }
  });
}
