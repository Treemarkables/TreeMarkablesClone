// Derives an invoice's line items from the best available source for a job, in
// priority order: accepted/sent proposal → quote → the job's own line items.
//
// Single source of truth shared by the InvoiceBuilder (auto-init + the manual
// "Import" button) and the one-button Complete & Invoice flow, so a one-click
// invoice is exactly what the builder would have pre-filled. All prices here
// are ex-GST (proposal/quote prices are ex-GST; invoices are stored ex-GST).

export interface InvoiceSourceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;
  materialId?: string;
  serviceId?: string;
  unitCost?: number;
}

// Proposals/quotes: accepted wins, then sent, then the most recent.
export function pickInvoiceSourceDocument(docs: any[] | null | undefined): any {
  const list = Array.isArray(docs) ? docs : [];
  return (
    list.find((d: any) => d.status === "accepted") ||
    list.find((d: any) => d.status === "sent") ||
    list[0]
  );
}

export function extractInvoiceLineItems({
  proposals,
  quotes,
  jobLineItems,
}: {
  proposals?: any[] | null;
  quotes?: any[] | null;
  jobLineItems?: any[] | null;
}): InvoiceSourceLineItem[] {
  const proposal = pickInvoiceSourceDocument(proposals);
  const quote = pickInvoiceSourceDocument(quotes);

  const items: InvoiceSourceLineItem[] = [];

  // Proposal items may live at the top level OR nested inside sections.
  const proposalItemArrays: any[][] = [];
  if (Array.isArray(proposal?.lineItems)) {
    proposalItemArrays.push(proposal.lineItems);
  } else if (Array.isArray(proposal?.sections)) {
    proposal.sections.forEach((section: any) => {
      if (Array.isArray(section.lineItems)) {
        proposalItemArrays.push(section.lineItems);
      }
    });
  }
  proposalItemArrays.forEach((arr) => {
    arr.forEach((item: any) => {
      items.push({
        id: Math.random().toString(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice || item.rate || 0),
        total: parseFloat(item.total || item.totalPrice || item.amount || 0),
      });
    });
  });

  // Carry the proposal-level discount onto the invoice as a negative line
  // item. Proposals store discountAmount as ex-GST dollars against the
  // pre-discount `subtotal`; invoices have no discount column, so without
  // this row an invoice built from a discounted proposal (e.g. a VIP
  // percentage discount) reverts to the full pre-discount price.
  if (items.length > 0) {
    const discountDollars =
      parseFloat(proposal?.discountAmount?.toString() || "0") || 0;
    if (discountDollars > 0) {
      const preDiscountSubtotal =
        parseFloat(proposal?.subtotal?.toString() || "0") || 0;
      const percent =
        proposal?.discountType === "percentage" && preDiscountSubtotal > 0
          ? Math.round((discountDollars / preDiscountSubtotal) * 10000) / 100
          : null;
      items.push({
        id: Math.random().toString(),
        description: percent ? `Discount (${percent}%)` : "Discount",
        quantity: 1,
        unitPrice: -discountDollars,
        total: -discountDollars,
      });
    }
  }

  // Fall back to the quote's line items.
  if (items.length === 0 && Array.isArray(quote?.lineItems)) {
    quote.lineItems.forEach((item: any) => {
      items.push({
        id: Math.random().toString(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice || item.rate || 0),
        total: parseFloat(item.total || item.amount || 0),
      });
    });
  }

  // Last resort: the job's own line items (set via the Quote tab). These can
  // be unpriced placeholders (e.g. a "Tree care" category row at $0.00).
  if (items.length === 0 && Array.isArray(jobLineItems) && jobLineItems.length > 0) {
    jobLineItems.forEach((item: any) => {
      items.push({
        id: item.id || Math.random().toString(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.rate || 0,
        total:
          item.total ||
          item.amount ||
          (item.quantity || 1) * (item.unitPrice || item.rate || 0) ||
          0,
        category: item.category,
        serviceId: item.serviceId,
        materialId: item.materialId,
        unitCost: item.unitCost,
      });
    });
  }

  return items;
}
