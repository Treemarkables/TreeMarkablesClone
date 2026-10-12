// Some customers must always be invoiced as the organisation, never a person.
// Gisborne District Council (GDC) is the first: staff contacts change job to job
// (and many GDC customer records are named after the staff member who rang),
// but every invoice, PDF Bill To, email greeting and Xero contact must read
// "Gisborne District Council".

export const GDC_BILLING_NAME = "Gisborne District Council";

type OrgBillingInput = {
  name?: string | null;
  email?: string | null;
  invoiceCcEmail?: string | null;
  billingContactEmail?: string | null;
  jobContactEmail?: string | null;
} | null | undefined;

const GDC_NAME_RE = /\b(gisborne\s+(district\s+)?council|gdc)\b/i;
const GDC_EMAIL_RE = /@gdc\.govt\.nz\s*$/i;

/** Returns the forced organisation billing name for this customer/job, or null. */
export function orgOnlyBillingName(...sources: OrgBillingInput[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    if (s.name && GDC_NAME_RE.test(s.name)) return GDC_BILLING_NAME;
    for (const e of [s.email, s.invoiceCcEmail, s.billingContactEmail, s.jobContactEmail]) {
      if (e && GDC_EMAIL_RE.test(e)) return GDC_BILLING_NAME;
    }
  }
  return null;
}

/** Use the organisation name when one is forced, otherwise the given name. */
export function resolveBillingName<T extends string | null | undefined>(
  fallback: T,
  ...sources: OrgBillingInput[]
): string | T {
  return orgOnlyBillingName(...sources) ?? fallback;
}
