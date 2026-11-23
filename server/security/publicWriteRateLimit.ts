/**
 * Rate limits for unauthenticated mutating routes.
 *
 * Login (`/api/auth/login`) and AI endpoints keep their own throttles
 * (loginThrottle + usageMeter) — this middleware skips those so we do not
 * double-break field login or monthly AI caps.
 *
 * Webhooks are also skipped (Twilio/Stripe/Resend would 429 in a burst).
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { PostgresRateLimitStore } from "./postgresRateLimitStore";

export interface PublicWriteRule {
  name: string;
  /** Human-readable path pattern(s) for PR / docs. */
  routes: string[];
  limit: number;
  windowMs: number;
  match: (path: string) => boolean;
}

export const PUBLIC_WRITE_RULES: PublicWriteRule[] = [
  {
    name: "contact-forms",
    routes: ["POST /api/contact", "POST /api/public/mulch-order"],
    // Preserve the existing 5 / 10 min shared budget (contact + mulch).
    limit: 5,
    windowMs: 10 * 60 * 1000,
    match: (path) => path === "/api/contact" || path === "/api/public/mulch-order",
  },
  {
    name: "signup",
    routes: ["POST /api/signup"],
    limit: 5,
    windowMs: 15 * 60 * 1000,
    match: (path) => path === "/api/signup",
  },
  {
    name: "customer-auth",
    routes: ["POST /api/customer-auth"],
    limit: 20,
    windowMs: 15 * 60 * 1000,
    match: (path) => path === "/api/customer-auth",
  },
  {
    name: "review-submit",
    routes: ["POST /api/reviews/submit"],
    limit: 10,
    windowMs: 15 * 60 * 1000,
    match: (path) => path === "/api/reviews/submit",
  },
  {
    name: "document-write",
    routes: [
      "POST /api/proposals/:id/accept",
      "POST /api/proposals/:id/viewed",
      "POST /api/proposals/:id/deposit-checkout",
      "POST /api/quotes/:id/accept",
      "POST /api/invoices/:id/payment-checkout",
      "POST /api/invoices/:id/request-service",
    ],
    // Generous: a customer tapping Accept / Pay now a few times must not lock out.
    limit: 30,
    windowMs: 15 * 60 * 1000,
    match: (path) =>
      /^\/api\/proposals\/[^/]+\/(accept|viewed|deposit-checkout)$/.test(path) ||
      /^\/api\/quotes\/[^/]+\/accept$/.test(path) ||
      /^\/api\/invoices\/[^/]+\/(payment-checkout|request-service)$/.test(path),
  },
];

const TOO_MANY =
  "Too many requests. Please wait a few minutes and try again, or call us directly.";

function makeLimiter(rule: PublicWriteRule): RequestHandler {
  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Don't validate req.ip — trust proxy is set at the app, and the key
    // generator already falls back to socket address.
    validate: { xForwardedForHeader: false, ip: false },
    store: new PostgresRateLimitStore(`public:${rule.name}:`),
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
    handler: (_req, res) => {
      res.status(429).json({ success: false, message: TOO_MANY });
    },
  });
}

const limiters: Array<{ rule: PublicWriteRule; handler: RequestHandler }> =
  PUBLIC_WRITE_RULES.map((rule) => ({ rule, handler: makeLimiter(rule) }));

export function matchPublicWriteRule(path: string): PublicWriteRule | undefined {
  return PUBLIC_WRITE_RULES.find((rule) => rule.match(path));
}

export function publicMutatingRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method !== "POST") {
    next();
    return;
  }
  const matched = limiters.find(({ rule }) => rule.match(req.path));
  if (!matched) {
    next();
    return;
  }
  matched.handler(req, res, next);
}
