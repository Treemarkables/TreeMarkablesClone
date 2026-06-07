/**
 * Inflow — Business identity helper (Trade Generalization Phase A).
 *
 * Single source of truth for turning a `businessSettings` row into the identity
 * strings that customer-facing output + AI prompts should use, instead of the
 * literals "Treemarkables" / "Jules" / "arborist" hardcoded across the app.
 *
 * Every field falls back to Treemarkables' current value, so behaviour is
 * UNCHANGED until a business sets its own — the de-hardcoding is safe to roll
 * out incrementally (wire one consumer at a time). See
 * INFLOW_TRADE_GENERALIZATION_PLAN.md (Track A).
 */

import type { BusinessSettings } from "@shared/schema";
import { getTradePreset } from "./trades/presets";

export interface BusinessIdentity {
  name: string;        // "Treemarkables"
  ownerName: string;   // "Jules" — AI persona + email sign-offs
  discipline: string;  // "arborist" — "a New Zealand {discipline} business"
  tagline: string;     // "Qualified Arborists" — PDF/email footer line
  phone: string;
  email: string;
  address: string;
}

// Current Treemarkables literals — the fallback so nothing changes until a
// business overrides them.
const DEFAULTS: BusinessIdentity = {
  name: "Treemarkables",
  ownerName: "Jules",
  discipline: "arborist",
  tagline: "Qualified Arborists",
  phone: "",
  email: "",
  address: "",
};

type SettingsLike = Partial<
  Pick<
    BusinessSettings,
    | "businessName"
    | "ownerName"
    | "businessDiscipline"
    | "businessTagline"
    | "businessPhone"
    | "businessEmail"
    | "businessAddress"
    | "industry"
  >
> | null | undefined;

export function getBusinessIdentity(settings: SettingsLike): BusinessIdentity {
  return {
    name: settings?.businessName || DEFAULTS.name,
    ownerName: settings?.ownerName || DEFAULTS.ownerName,
    discipline: settings?.businessDiscipline || DEFAULTS.discipline,
    tagline: settings?.businessTagline || DEFAULTS.tagline,
    phone: settings?.businessPhone || DEFAULTS.phone,
    email: settings?.businessEmail || DEFAULTS.email,
    address: settings?.businessAddress || DEFAULTS.address,
  };
}

/**
 * Trade-aware AI context (Trade Generalization Phase C). Builds the one line every
 * AI prompt should lead with — this business's name + trade + the trade's domain
 * vocabulary — from settings + the selected trade preset. No prompt should contain
 * a literal trade term or business name again. On the tree preset (default) this
 * reads equivalently to today: "…Treemarkables, a New Zealand arborist business.
 * Relevant work includes: tree removal, stump grind, mulch, …".
 */
export function buildBusinessContext(settings: SettingsLike): string {
  const id = getBusinessIdentity(settings);
  const preset = getTradePreset(settings?.industry);
  return `${id.name}, a New Zealand ${id.discipline} business. Relevant work for this trade includes: ${preset.aiVocabulary}.`;
}
