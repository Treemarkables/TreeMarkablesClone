/**
 * Session-cookie selection when the browser sends more than one
 * `treemarkables.sid`.
 *
 * The host-only cookie (current) and the legacy Domain=.treemarkables.co.nz
 * cookie share a name. The shipped iOS shell still loads app.treemarkables.co.nz,
 * so that host receives both. The `cookie` parser express-session uses keeps the
 * FIRST value. Browsers send the older domain cookie first, and that row often
 * has no employeeId. requireAdmin then answers "Admin access required. Please
 * log in." even though a later cookie is the signed-in owner.
 *
 * This does not accept a cookie the browser did not send, and it does not skip
 * a session that already has an employeeId (a real crew session stays crew).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const SESSION_COOKIE_NAME = "treemarkables.sid";

/**
 * First-party session cookie. SameSite=None is dropped by the iOS WKWebView
 * (ITP treats it as a cross-site tracking cookie even though the shell loads
 * the app host itself). The UI then keeps the localStorage user and Add Staff
 * posts with no session: "Admin access required. Please log in." Lax is sent
 * on same-origin fetch, which is every request this app makes.
 */
export const SESSION_COOKIE_SAMESITE = "lax" as const;

/** Same algorithm as the `cookie-signature` package express-session uses. */
export function signSessionId(sid: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  return `${sid}.${mac}`;
}

export function unsignSessionId(signed: string, secret: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const sid = signed.slice(0, dot);
  const expected = signSessionId(sid, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signed);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sid;
}

/** Raw `treemarkables.sid` values in header order (still percent-encoded). */
export function listSessionCookieValues(cookieHeader: string | undefined): string[] {
  if (!cookieHeader) return [];
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq).trim() !== SESSION_COOKIE_NAME) continue;
    const raw = trimmed.slice(eq + 1).trim();
    if (raw) values.push(raw);
  }
  return values;
}

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Unsigned sid for a raw cookie value, or null if it is not signed by `secrets`. */
export function sessionIdFromCookieValue(rawValue: string, secrets: string[]): string | null {
  const decoded = decodeCookieValue(rawValue);
  if (!decoded.startsWith("s:")) return null;
  const signed = decoded.slice(2);
  for (const secret of secrets) {
    const sid = unsignSessionId(signed, secret);
    if (sid) return sid;
  }
  return null;
}

/**
 * When the first session cookie is not a live employee session, return a later
 * raw value that is. Returns null when the header should be left alone.
 */
export async function chooseSessionCookieValue(
  values: string[],
  secrets: string[],
  hasEmployee: (sid: string) => Promise<boolean>,
): Promise<string | null> {
  if (values.length < 2) return null;
  const firstSid = sessionIdFromCookieValue(values[0], secrets);
  if (firstSid && (await hasEmployee(firstSid))) return null;
  for (const raw of values.slice(1)) {
    const sid = sessionIdFromCookieValue(raw, secrets);
    if (!sid) continue;
    if (await hasEmployee(sid)) return raw;
  }
  return null;
}

export function preferSessionCookieHeader(cookieHeader: string, chosenRaw: string): string {
  const rest = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return [`${SESSION_COOKIE_NAME}=${chosenRaw}`, ...rest].join("; ");
}

export async function resolveSessionCookieHeader(
  cookieHeader: string | undefined,
  secrets: string[],
  hasEmployee: (sid: string) => Promise<boolean>,
): Promise<string | undefined> {
  if (!cookieHeader) return cookieHeader;
  const values = listSessionCookieValues(cookieHeader);
  const chosen = await chooseSessionCookieValue(values, secrets, hasEmployee);
  if (!chosen) return cookieHeader;
  return preferSessionCookieHeader(cookieHeader, chosen);
}

export function preferEmployeeSessionCookie(options: {
  secrets: string[];
  hasEmployee: (sid: string) => Promise<boolean>;
  onPreferred?: (res: Response) => void;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const current = req.headers.cookie;
      const nextHeader = await resolveSessionCookieHeader(
        current,
        options.secrets,
        options.hasEmployee,
      );
      if (current && nextHeader && nextHeader !== current) {
        req.headers.cookie = nextHeader;
        options.onPreferred?.(res);
        console.log("[session] preferred the signed-in session cookie over an empty duplicate");
      }
    } catch (err) {
      console.error("[session] duplicate session cookie preference failed", err);
    }
    next();
  };
}
