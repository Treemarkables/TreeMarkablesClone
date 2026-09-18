/**
 * Wave 2 MFA + session-hygiene routes.
 *
 * Login itself stays in routes.ts (throttle + password). These endpoints cover
 * the TOTP challenge, enroll/disable, recovery codes, and list/revoke sessions.
 */
import type { Express, Request, Response } from "express";
import { APP_URL } from "../config/appUrl";
import { storage } from "../storage";
import { checkMfaThrottle, clearMfaThrottle } from "./loginThrottle";
import {
  consumeRecoveryCode,
  disableMfa,
  enableMfa,
  getMfaEnforcement,
  getMfaRow,
  remainingRecoveryCodeCount,
  replaceRecoveryCodes,
  verifyStoredTotp,
} from "./mfaService";
import { decryptTotpSecret, encryptTotpSecret } from "./mfaCrypto";
import { buildOtpauthUri, generateTotpSecret, groupSecret, normalizeTotpCode, verifyTotp } from "./totp";
import {
  beginPendingMfaSession,
  clearHostSessionCookie,
  clearLegacyDomainSessionCookie,
  establishEmployeeSession,
  pendingMfaActor,
} from "./authSession";
import {
  deleteEmployeeSession,
  deleteEmployeeSessions,
  listEmployeeSessions,
  toSessionListItem,
} from "./sessionHygiene";

type Middleware = (req: Request, res: Response, next: () => void) => void | Promise<void>;

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function issuerHost(): string {
  try {
    return new URL(APP_URL).host || "Inflow";
  } catch {
    return "Inflow";
  }
}

function requireAuthed(req: Request, res: Response): { employeeId: string; businessId?: string } | null {
  const employeeId = req.session.employeeId;
  if (!employeeId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  return { employeeId, businessId: req.session.businessId };
}

async function throttleOrReject(req: Request, res: Response, employeeId: string): Promise<boolean> {
  const { allowed } = await checkMfaThrottle({ ip: clientIp(req), employeeId });
  if (!allowed) {
    res.status(429).json({
      success: false,
      message: "Too many authenticator attempts. Try again in a few minutes.",
    });
    return false;
  }
  return true;
}

export function registerMfaAndSessionRoutes(
  app: Express,
  deps: { requireSession: Middleware },
): void {
  app.get("/api/auth/mfa/status", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const row = await getMfaRow(actor.employeeId);
      const enforcement = await getMfaEnforcement(actor.businessId);
      const remainingCodes = row?.enabled ? await remainingRecoveryCodeCount(actor.employeeId) : 0;
      res.json({
        success: true,
        data: {
          enabled: Boolean(row?.enabled),
          enrolledAt: row?.enrolledAt ?? null,
          lastVerifiedAt: row?.lastVerifiedAt ?? null,
          remainingRecoveryCodes: remainingCodes,
          enforcement,
        },
      });
    } catch (error) {
      console.error("[MFA] status failed:", error);
      res.status(500).json({ success: false, message: "Could not load authenticator status" });
    }
  });

  // Start enroll: issue a new secret (held encrypted on the session until confirm).
  // Allowed for a fully signed-in user, or a pending login whose org requires enroll.
  app.post("/api/auth/mfa/setup", async (req: Request, res: Response) => {
    try {
      const pending = pendingMfaActor(req);
      const employeeId = req.session.employeeId || (pending?.purpose === "enroll" ? pending.employeeId : undefined);
      if (!employeeId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      const existing = await getMfaRow(employeeId);
      if (existing?.enabled) {
        return res.status(409).json({
          success: false,
          message: "Authenticator is already enabled. Disable it first to set up a new one.",
        });
      }
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(401).json({ success: false, message: "Employee not found" });
      }
      const secret = generateTotpSecret();
      req.session.pendingTotpSecret = encryptTotpSecret(secret);
      const accountName = employee.email || `${employee.firstName} ${employee.lastName}`.trim() || employee.id;
      const otpauthUri = buildOtpauthUri({
        secret,
        accountName,
        issuer: issuerHost(),
      });
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Could not start authenticator setup" });
        }
        res.json({
          success: true,
          data: {
            secret,
            secretGrouped: groupSecret(secret),
            otpauthUri,
          },
        });
      });
    } catch (error) {
      console.error("[MFA] setup failed:", error);
      res.status(500).json({ success: false, message: "Could not start authenticator setup" });
    }
  });

  app.post("/api/auth/mfa/enable", async (req: Request, res: Response) => {
    try {
      const pending = pendingMfaActor(req);
      const employeeId = req.session.employeeId || (pending?.purpose === "enroll" ? pending.employeeId : undefined);
      if (!employeeId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      const code = normalizeTotpCode(req.body?.code);
      if (!code) {
        return res.status(400).json({ success: false, message: "Enter the 6-digit code from your authenticator app" });
      }
      if (!req.session.pendingTotpSecret) {
        return res.status(400).json({ success: false, message: "Start authenticator setup first" });
      }
      if (!(await throttleOrReject(req, res, employeeId))) return;

      let secret: string;
      try {
        secret = decryptTotpSecret(req.session.pendingTotpSecret);
      } catch {
        return res.status(400).json({ success: false, message: "Start authenticator setup first" });
      }
      const check = verifyTotp(secret, code);
      if (!check.valid) {
        return res.status(401).json({ success: false, message: "That code is not valid. Try the next one from the app." });
      }

      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(401).json({ success: false, message: "Employee not found" });
      }
      const recoveryCodes = await enableMfa({
        employeeId,
        businessId: employee.businessId,
        totpSecret: secret,
      });
      delete req.session.pendingTotpSecret;
      await clearMfaThrottle(employeeId);
      await deleteEmployeeSessions(employeeId, { keepSid: req.sessionID });

      if (pending?.purpose === "enroll") {
        return establishEmployeeSession(req, res, employee, {
          mfaVerified: true,
          mfaEnabled: true,
          recoveryCodes,
        });
      }

      req.session.mfaVerified = true;
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Authenticator enabled, but the session failed to save" });
        }
        res.json({
          success: true,
          data: { recoveryCodes, enabled: true },
        });
      });
    } catch (error) {
      console.error("[MFA] enable failed:", error);
      res.status(500).json({ success: false, message: "Could not enable authenticator" });
    }
  });

  app.post("/api/auth/mfa/verify", async (req: Request, res: Response) => {
    try {
      const pending = pendingMfaActor(req);
      if (!pending || pending.purpose !== "challenge") {
        return res.status(401).json({ success: false, message: "Sign in with email and password first" });
      }
      const code = normalizeTotpCode(req.body?.code);
      if (!code) {
        return res.status(400).json({ success: false, message: "Enter the 6-digit code from your authenticator app" });
      }
      if (!(await throttleOrReject(req, res, pending.employeeId))) return;

      const match = await verifyStoredTotp(pending.employeeId, code);
      if (!match.valid) {
        return res.status(401).json({ success: false, message: "That code is not valid. Try the next one from the app." });
      }
      const employee = await storage.getEmployee(pending.employeeId);
      if (!employee) {
        return res.status(401).json({ success: false, message: "Employee not found" });
      }
      await clearMfaThrottle(pending.employeeId);
      return establishEmployeeSession(req, res, employee, { mfaVerified: true, mfaEnabled: true });
    } catch (error) {
      console.error("[MFA] verify failed:", error);
      res.status(500).json({ success: false, message: "Could not verify authenticator" });
    }
  });

  app.post("/api/auth/mfa/verify-recovery", async (req: Request, res: Response) => {
    try {
      const pending = pendingMfaActor(req);
      if (!pending || pending.purpose !== "challenge") {
        return res.status(401).json({ success: false, message: "Sign in with email and password first" });
      }
      if (!(await throttleOrReject(req, res, pending.employeeId))) return;
      const match = await consumeRecoveryCode(pending.employeeId, req.body?.code);
      if (!match.valid) {
        return res.status(401).json({ success: false, message: "That recovery code is not valid" });
      }
      const employee = await storage.getEmployee(pending.employeeId);
      if (!employee) {
        return res.status(401).json({ success: false, message: "Employee not found" });
      }
      await clearMfaThrottle(pending.employeeId);
      return establishEmployeeSession(req, res, employee, { mfaVerified: true, mfaEnabled: true });
    } catch (error) {
      console.error("[MFA] recovery verify failed:", error);
      res.status(500).json({ success: false, message: "Could not verify recovery code" });
    }
  });

  app.post("/api/auth/mfa/disable", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const row = await getMfaRow(actor.employeeId);
      if (!row?.enabled) {
        return res.json({ success: true, data: { enabled: false } });
      }
      if (!(await throttleOrReject(req, res, actor.employeeId))) return;

      const totp = normalizeTotpCode(req.body?.code);
      let ok = false;
      if (totp) {
        ok = (await verifyStoredTotp(actor.employeeId, totp)).valid;
      } else if (req.body?.code) {
        ok = (await consumeRecoveryCode(actor.employeeId, req.body.code)).valid;
      }
      if (!ok) {
        return res.status(401).json({
          success: false,
          message: "Enter a valid authenticator or recovery code to turn this off",
        });
      }
      await disableMfa(actor.employeeId);
      delete req.session.pendingTotpSecret;
      req.session.mfaVerified = false;
      await clearMfaThrottle(actor.employeeId);
      req.session.save(() => {
        res.json({ success: true, data: { enabled: false } });
      });
    } catch (error) {
      console.error("[MFA] disable failed:", error);
      res.status(500).json({ success: false, message: "Could not disable authenticator" });
    }
  });

  app.post("/api/auth/mfa/recovery-codes", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const row = await getMfaRow(actor.employeeId);
      if (!row?.enabled) {
        return res.status(400).json({ success: false, message: "Turn on the authenticator first" });
      }
      const totp = normalizeTotpCode(req.body?.code);
      if (!totp) {
        return res.status(400).json({ success: false, message: "Enter the 6-digit code from your authenticator app" });
      }
      if (!(await throttleOrReject(req, res, actor.employeeId))) return;
      const match = await verifyStoredTotp(actor.employeeId, totp);
      if (!match.valid) {
        return res.status(401).json({ success: false, message: "That code is not valid. Try the next one from the app." });
      }
      const codes = await replaceRecoveryCodes({
        employeeId: actor.employeeId,
        businessId: actor.businessId,
      });
      await clearMfaThrottle(actor.employeeId);
      res.json({ success: true, data: { recoveryCodes: codes } });
    } catch (error) {
      console.error("[MFA] regenerate recovery codes failed:", error);
      res.status(500).json({ success: false, message: "Could not generate new recovery codes" });
    }
  });

  app.get("/api/auth/sessions", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const rows = await listEmployeeSessions(actor.employeeId);
      res.json({
        success: true,
        data: rows.map((row) => toSessionListItem(row, req.sessionID)),
      });
    } catch (error) {
      console.error("[sessions] list failed:", error);
      res.status(500).json({ success: false, message: "Could not load sessions" });
    }
  });

  app.delete("/api/auth/sessions/:sid", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const sid = String(req.params.sid || "");
      if (!sid) {
        return res.status(400).json({ success: false, message: "Session id required" });
      }
      if (sid === req.sessionID) {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ success: false, message: "Could not sign out this device" });
          }
          clearHostSessionCookie(res);
          clearLegacyDomainSessionCookie(res);
          res.json({ success: true, data: { current: true } });
        });
        return;
      }
      const deleted = await deleteEmployeeSession(actor.employeeId, sid);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }
      res.json({ success: true, data: { current: false } });
    } catch (error) {
      console.error("[sessions] revoke failed:", error);
      res.status(500).json({ success: false, message: "Could not sign out that device" });
    }
  });

  app.post("/api/auth/sessions/revoke-others", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      const revoked = await deleteEmployeeSessions(actor.employeeId, { keepSid: req.sessionID });
      res.json({ success: true, data: { revoked } });
    } catch (error) {
      console.error("[sessions] revoke-others failed:", error);
      res.status(500).json({ success: false, message: "Could not sign out other devices" });
    }
  });

  app.post("/api/auth/sessions/revoke-all", deps.requireSession, async (req: Request, res: Response) => {
    const actor = requireAuthed(req, res);
    if (!actor) return;
    try {
      await deleteEmployeeSessions(actor.employeeId);
      req.session.destroy((err) => {
        if (err) {
          // Rows are already gone; still clear the cookie.
          console.error("[sessions] revoke-all destroy error:", err);
        }
        clearHostSessionCookie(res);
        clearLegacyDomainSessionCookie(res);
        res.json({ success: true, data: { current: true } });
      });
    } catch (error) {
      console.error("[sessions] revoke-all failed:", error);
      res.status(500).json({ success: false, message: "Could not sign out everywhere" });
    }
  });
}

export { beginPendingMfaSession, establishEmployeeSession };
