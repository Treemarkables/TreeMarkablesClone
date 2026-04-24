/**
 * Shared document block rendering contract.
 * Used by both the server PDF generator and the client InvoiceTemplate
 * to ensure consistent field access and defaults.
 */

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  paymentTerms?: string;
  logoUrl?: string;
}

/**
 * Resolves company info from a DocumentTemplate record.
 * Handles the Drizzle camelCase field names from DB rows.
 */
export function resolveCompanyInfo(template: Record<string, unknown> | null | undefined): CompanyInfo {
  return {
    name: (template?.companyName as string | undefined) || 'Treemarkables LTD',
    address: (template?.companyAddress as string | undefined) || '213 Stanley Road, Gisborne',
    phone: (template?.companyPhone as string | undefined) || '027 216 6882',
    email: (template?.companyEmail as string | undefined) || 'quotes@treemarkables.nz',
    gstNumber: (template?.gstNumber as string | undefined) || '131-047-592',
    paymentTerms: (template?.paymentTerms as string | undefined) ?? undefined,
    logoUrl: (template?.logoUrl as string | undefined) ?? undefined,
  };
}

/**
 * Reads the saved block_config array from a template row (camelCase).
 * Returns blocks sorted by order, or [] if not present.
 */
export function resolveBlockConfig(template: Record<string, unknown> | null | undefined): Array<{
  id: string;
  type: string;
  visible: boolean;
  order: number;
  config: Record<string, unknown>;
}> {
  const raw = template?.blockConfig;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return [...raw].sort((a: { order: number }, b: { order: number }) => a.order - b.order);
}
