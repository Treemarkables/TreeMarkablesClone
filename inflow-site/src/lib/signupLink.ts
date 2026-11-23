/**
 * Commercial-site handoff into the app's self-serve signup.
 *
 * The app page at `/signup` posts to `POST /api/signup`, which calls `createTenant`
 * (business + admin employee + freemium subscription). This module only builds that
 * URL. It never returns a mailto link.
 *
 * Plan keys match `client/src/pages/Signup.tsx` and `POST /api/signup`.
 */

export const LIVE_APP_ORIGIN = "https://app.inflowapp.co.nz";
export const LIVE_APP_SIGNUP_URL = `${LIVE_APP_ORIGIN}/signup`;

const SIGNUP_PLANS = new Set(["freemium", "crew", "business"]);
const MAX_FIELD = 200;

export type SignupLinkFields = {
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  plan?: string;
};

function isUsableSignupUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Use a non-production signup URL only when it is an absolute http(s) URL. */
export function resolveAppSignupUrl(override: string | undefined, fallback = LIVE_APP_SIGNUP_URL): string {
  const candidate = (override ?? "").trim();
  if (candidate && isUsableSignupUrl(candidate)) return candidate.replace(/\/$/, "");
  return fallback;
}

function clip(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_FIELD);
}

/**
 * Absolute signup URL with optional prefill query params.
 * Returns null when `base` is not a usable http(s) URL (including mailto:).
 */
export function signupHref(base: string, fields: SignupLinkFields = {}): string | null {
  if (!isUsableSignupUrl(base)) return null;
  const url = new URL(base);
  const plan = clip(fields.plan);
  if (plan && SIGNUP_PLANS.has(plan)) url.searchParams.set("plan", plan);
  const set = (param: string, value: string | undefined) => {
    const clipped = clip(value);
    if (clipped) url.searchParams.set(param, clipped);
  };
  set("businessName", fields.businessName);
  set("firstName", fields.firstName);
  set("lastName", fields.lastName);
  set("email", fields.email);
  return url.toString();
}

export function continueToSignup(input: {
  signupUrl: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  plan?: string;
}): { ok: true; href: string } | { ok: false; reason: string } {
  const href = signupHref(input.signupUrl, {
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    email: input.email,
    plan: input.plan ?? "freemium",
  });
  if (!href) {
    return { ok: false, reason: "Signup isn't available right now." };
  }
  return { ok: true, href };
}
