/**
 * Role-checklist feature gating.
 *
 * The Job Card role checklist (Kaitiaki / Kaiwhangai / Kaitirotiro) is specific
 * to Treemarkables (tenant #1) — the role names are te reo Māori and reflect how
 * that one business runs its crews. It is intentionally hidden from every other
 * Inflow tenant.
 *
 * Gating is a businessId allowlist rather than a per-tenant feature flag because
 * this is a one-off, business-specific feature, not something we sell or toggle.
 *
 * NOTE: each environment (prod, the local Neon dev branch, any staging branch)
 * has its OWN Treemarkables row with its OWN random businessId — they are NOT
 * the same UUID. Add every environment's Treemarkables businessId you care about
 * to the array below. An id that isn't present simply means the feature is hidden
 * for that tenant in that environment.
 */

export const TREEMARKABLES_BUSINESS_IDS: readonly string[] = [
  // Treemarkables (tenant #1). NOTE: the businessId differs between prod and the
  // local dev Neon branch — the tenancy backfill assigned the discriminator
  // independently in each environment (the row PK id='default' is shared from
  // the fork, but business_id is not). Both must be listed. Other tenants
  // (e.g. "Cut right") have their own businessId and stay hidden.
  "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2", // prod
  "215d4e9b-2bf0-4ef8-98c4-1b02a435f7ce", // local dev branch
];

/** True only for the Treemarkables tenant(s) that own the role-checklist feature. */
export function businessHasRoleChecklist(businessId: string | null | undefined): boolean {
  return !!businessId && TREEMARKABLES_BUSINESS_IDS.includes(businessId);
}
