/**
 * Query-param prefill for /signup.
 *
 * The commercial site (inflow-site) links here with businessName, firstName,
 * lastName, email, and plan. Keep the plan keys aligned with POST /api/signup
 * and inflow-site/src/lib/signupLink.ts.
 */

const SIGNUP_PLAN_KEYS = ["freemium", "crew", "business"] as const;

export type SignupPlanKey = (typeof SIGNUP_PLAN_KEYS)[number];

export type SignupPrefill = {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  planKey: SignupPlanKey;
};

function isPlanKey(value: string): value is SignupPlanKey {
  return (SIGNUP_PLAN_KEYS as readonly string[]).includes(value);
}

function clip(raw: string | null, max = 200): string {
  return (raw ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function readSignupPrefill(search: string): SignupPrefill {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const plan = clip(params.get("plan"), 40);
  return {
    businessName: clip(params.get("businessName")),
    firstName: clip(params.get("firstName")),
    lastName: clip(params.get("lastName")),
    email: clip(params.get("email")),
    planKey: isPlanKey(plan) ? plan : "freemium",
  };
}
