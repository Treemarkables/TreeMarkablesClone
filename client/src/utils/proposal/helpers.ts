import type { ProposalSection, LineItem, LineItemChoice } from "@/types/proposal";

export const calculateLineItemTotal = (item: Partial<LineItem>): number => {
  if (item.pricingType === "fixed" && item.fixedPrice !== undefined) {
    return item.fixedPrice;
  }
  
  if (item.pricingType === "choice" && item.selectedChoiceId) {
    const selectedChoice = item.choices?.find(choice => choice.id === item.selectedChoiceId);
    if (selectedChoice) {
      return (item.quantity || 1) * selectedChoice.price;
    }
  }
  
  return (item.quantity || 0) * (item.unitPrice || 0);
};

export const calculateSectionTotal = (section: ProposalSection): number => {
  return section.lineItems
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.totalPrice, 0);
};

export const calculateProposalTotals = (sections: ProposalSection[], taxRate: number = 15) => {
  const selectedLineItems = sections.flatMap(section => 
    section.lineItems.filter(item => item.selected)
  );
  
  let subtotalExGst = 0;
  let gstAmount = 0;
  
  selectedLineItems.forEach(item => {
    const itemPrice = item.totalPrice;
    const isInclusive = item.priceIncludesTax || false;
    const gstRate = taxRate / 100;
    
    if (isInclusive) {
      // Price includes GST - extract the ex-GST amount
      const exGst = itemPrice / (1 + gstRate);
      subtotalExGst += exGst;
      gstAmount += itemPrice - exGst;
    } else {
      // Price excludes GST - add it
      subtotalExGst += itemPrice;
      gstAmount += itemPrice * gstRate;
    }
  });
  
  const grandTotal = subtotalExGst + gstAmount;
  
  return {
    selectedLineItems,
    subtotal: subtotalExGst,
    taxAmount: gstAmount,
    grandTotal
  };
};

export const createInitialSectionFromJob = (job: any): ProposalSection => {
  return {
    id: 'section-1',
    title: job.serviceType || 'Job Description',
    description: job.description || '',
    photos: [],
    lineItems: job.lineItems ? job.lineItems.map((item: any, index: number) => ({
      id: item.id || `job-item-${index}`,
      description: item.description,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.total || (item.quantity || 1) * (item.unitPrice || 0),
      unit: item.unit || 'each',
      category: item.category || 'service',
      notes: item.notes || '',
      isOptional: false,
      selected: true,
      pricingType: 'normal' as const,
      choices: [],
      selectedChoiceId: undefined,
      fixedPrice: undefined,
    })) : [],
    sortOrder: 1
  };
};

export const PROPOSAL_STATUS_TEXT = {
  sent: "This Proposal is sent. Any changes made here will be visible to the client, even if the Proposal is not sent again.",
  draft: "This proposal is in draft mode. It has not been sent to the client yet.",
};
