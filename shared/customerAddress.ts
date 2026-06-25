// Best-effort billing address for a customer.
//
// Many imported customers have a null `customers.address` but populated
// `city`/`region`. A second slice of imports had the street address typed
// into the `name` field itself ("175 gaddums", "21 Stanley road") — for
// those the address columns are all empty and the name pattern-matches
// "<digits> <word>". Compose from whichever of those the customer has.
//
// Used by invoice "Bill To" rendering (web view, PDF, email) so the billing
// address always reflects the live customer record rather than a snapshot
// frozen at invoice-creation time. Mirrored locally in GlobalJobCard.tsx and
// JobDetailsPanel.tsx (those kept their own copy to avoid threading an import
// through too many call sites — keep all three in sync if the logic changes).
export function composeCustomerAddress(
  customer:
    | {
        address?: string | null;
        city?: string | null;
        region?: string | null;
        name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!customer) return "";
  const street = (customer.address || "").trim();
  if (street) return street;
  const parts = [customer.city, customer.region]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(", ");
  // Last-resort fallback: many imports stored the address in the name field.
  // Heuristic: starts with one or more digits, whitespace, then a word.
  const name = (customer.name || "").trim();
  if (/^\d+\s+\S/.test(name)) return name;
  return "";
}
