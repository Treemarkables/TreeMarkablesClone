import type { LineItem, LineItemChoice, PricingType } from "../types/proposal.ts";

/**
 * Raw line from the job card or jobs.line_items. Create-mode only —
 * a saved proposal is loaded from its own sections and never passed here.
 */
export interface ProposalSourceLine {
  id?: string;
  description?: string;
  name?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  price?: string | number;
  total?: string | number;
  totalPrice?: string | number;
  costPrice?: string | number;
  unit?: string;
  category?: string;
  itemCode?: string;
  isOptional?: boolean;
  pricingType?: PricingType;
  choices?: LineItemChoice[];
  priceIncludesTax?: boolean;
  markupPct?: string | number;
}

export interface NewProposalLineItems {
  items: LineItem[];
  /** Set when the list is the blank starter row, so the builder can open it. */
  starterId: string | null;
}

/**
 * Line items for a proposal that has not been saved yet.
 *
 * Real job lines are copied through. When the job has none, the builder
 * still opens one row (qty 1, $0) so a price can be typed — but the
 * description stays blank.
 *
 * Do not fill that row from the job title or service type. Jobs created
 * from a conversation store the customer's name in jobs.title (job 4223
 * is "Christopher Picken", same as the customer, with an empty line_items
 * array). Copying that title made the name look like a line item.
 */
export function lineItemsForNewProposal(
  sourceItems: ProposalSourceLine[] | null | undefined,
  now: number = Date.now(),
): NewProposalLineItems {
  if (sourceItems && sourceItems.length > 0) {
    return {
      starterId: null,
      items: sourceItems.map((item, idx) => mapSourceLine(item, idx)),
    };
  }

  const starterId = `item-starter-${now}`;
  return {
    starterId,
    items: [{
      id: starterId,
      description: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      unit: "each",
      category: "",
      isOptional: false,
      selected: true,
      pricingType: "normal",
      choices: [],
      priceIncludesTax: false,
      costPrice: 0,
      markupPct: 0,
    }],
  };
}

function mapSourceLine(item: ProposalSourceLine, idx: number): LineItem {
  const qty = parseFloat(String(item.quantity ?? 1)) || 1;
  const rawTotal = parseFloat(String(item.totalPrice ?? item.total ?? 0)) || 0;
  const rawUnit = parseFloat(String(item.unitPrice ?? item.price ?? 0)) || 0;
  const unitPrice = rawUnit || (rawTotal > 0 ? rawTotal / qty : 0);
  const totalPrice = (qty * unitPrice) || rawTotal;
  const costPrice = parseFloat(String(item.costPrice ?? 0)) || unitPrice;
  return {
    id: item.id || `prefill-${idx}`,
    description: item.description || item.name || "",
    quantity: qty,
    unitPrice,
    totalPrice,
    unit: item.unit || "each",
    category: item.category || item.itemCode || "",
    isOptional: item.isOptional || false,
    selected: true,
    pricingType: item.pricingType || "normal",
    choices: item.choices || [],
    priceIncludesTax: item.priceIncludesTax || false,
    costPrice,
    markupPct: parseFloat(String(item.markupPct ?? 0)) || 0,
  };
}
