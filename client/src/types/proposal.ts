export interface LineItemChoice {
  id: string;
  label: string;
  description: string;
  price: number;
  isDefault?: boolean;
}

export type PricingType = 'normal' | 'choice' | 'fixed';

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  category?: string;
  notes?: string;
  isOptional: boolean;
  selected: boolean;
  pricingType: PricingType;
  choices: LineItemChoice[];
  selectedChoiceId?: string;
  fixedPrice?: number;
  priceIncludesTax?: boolean;
  costPrice?: number;
  markupPct?: number;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  filename: string;
  type: string;
  category: string;
  notes?: string;
  capturedAt: string;
  thumbnailUrl?: string;
}

export interface ProposalSection {
  id: string;
  title: string;
  description: string;
  photos: UploadedPhoto[];
  lineItems: LineItem[];
  sortOrder: number;
}
