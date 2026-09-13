// Canonical help-content category vocabulary, shared by the subscriber-facing
// /help page and the owner authoring UI (/admin/help). Both help articles and
// knowledge videos (videos.kind='knowledge') use this list — matches the
// helpArticles.category / videos.category vocab noted in shared/schema.ts.
// Array order = section display order on /help (roughly the sales workflow:
// inquiry comes in → quote it → run the job).
export const HELP_CATEGORIES = [
  "Getting started",
  "Inquiries & Messages",
  "Quotes & Invoicing",
  "Jobs",
  "Customers & CRM",
  "Staff & Permissions",
  "Safety",
  "Settings & Billing",
];

// Sort rank: known categories in HELP_CATEGORIES order, unknown categories
// after them (callers alpha-sort within equal ranks), uncategorised last.
export function helpCategoryRank(category: string | null | undefined): number {
  if (!category) return HELP_CATEGORIES.length + 1;
  const idx = HELP_CATEGORIES.indexOf(category);
  return idx === -1 ? HELP_CATEGORIES.length : idx;
}
