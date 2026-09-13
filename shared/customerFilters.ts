// Keyword heuristic for spotting supplier/expense companies that were
// imported into the customer list (e.g. from accounting exports). Shared so
// the server-side customers filter and any client display logic agree on
// exactly the same list.
export const EXPENSE_COMPANY_KEYWORDS = [
  "equipment",
  "supply",
  "supplies",
  "hardware",
  "rental",
  "hire",
  "machinery",
  "tools",
  "parts",
  "warehouse",
  "wholesale",
  "distribution",
  "fuel",
  "gas",
  "materials",
  "steel",
  "timber",
  "lumber",
  "concrete",
  "aggregate",
  "transport",
  "logistics",
  "delivery",
  "freight",
  "haulage",
  "maintenance",
  "repair",
  "service center",
  "garage",
  "workshop",
  "automotive",
  "spare parts",
  "industrial",
  "chemical",
  "safety",
  "ppe",
  "protective",
  "insurance",
  "accountant",
  "accounting",
  "legal",
  "solicitor",
  "consultant",
  "office supplies",
] as const;

export function isPotentialExpenseCompany(name: string | null | undefined): boolean {
  const lowered = (name || "").toLowerCase();
  return EXPENSE_COMPANY_KEYWORDS.some((keyword) => lowered.includes(keyword));
}
