/**
 * Inflow — Business identity helper (Trade Generalization Phase A).
 *
 * Single source of truth for turning a `businessSettings` row into the identity
 * strings that customer-facing output + AI prompts should use, instead of the
 * literals "Treemarkables" / "Jules" / "arborist" hardcoded across the app.
 *
 * Fields fall back to NEUTRAL / generic values, not Treemarkables' — so a new
 * tenant starts trade-agnostic and fills in its own via Company Info. Treemarkables
 * keeps its values because they're stored on its own settings row (seeded by name),
 * not because they're the fallback. See INFLOW_TRADE_GENERALIZATION_PLAN.md.
 */

import type { BusinessSettings } from "@shared/schema";

export interface BusinessIdentity {
  name: string;        // "Treemarkables"
  ownerName: string;   // "Jules" — AI persona + email sign-offs
  discipline: string;  // "arborist" — "a New Zealand {discipline} business"
  tagline: string;     // "Qualified Arborists" — PDF/email footer line
  phone: string;
  email: string;
  address: string;
  gstNumber: string;   // per-business GST; "" when unset (NEVER Treemarkables')
}

// NEUTRAL fallbacks — never Treemarkables/Jules/arborist. An unset business shows
// nothing (blank name/owner/tagline) rather than leaking another business's
// identity; `discipline` falls back to a generic "field-service" so AI prompts
// ("a New Zealand {discipline} business") still read naturally. Treemarkables keeps
// its values from its own settings row.
const DEFAULTS: BusinessIdentity = {
  name: "",
  ownerName: "",
  discipline: "field-service",
  tagline: "",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
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
    | "businessGstNumber"
    | "businessWebsite"
    | "brandHeaderColor"
    | "brandAccentColor"
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
    gstNumber: settings?.businessGstNumber || DEFAULTS.gstNumber,
  };
}

export interface BrandColors {
  headerColor: string; // header/footer band background
  accentColor: string; // wordmark / accent rule / CTA / amount
}

// Default brand palette = Treemarkables' black + neon-green. Matches the
// business_settings column defaults, so every email is unchanged until a business
// picks its own colours in Company Info. Unlike identity text, colours are not an
// identity leak, so a shared visual default is acceptable per the product call.
const BRAND_COLOR_DEFAULTS: BrandColors = {
  headerColor: "#0b0b0b",
  accentColor: "#39FF14",
};

/** Resolve a business's email brand colours, falling back to the default palette. */
export function getBrandColors(settings: SettingsLike): BrandColors {
  return {
    headerColor: settings?.brandHeaderColor || BRAND_COLOR_DEFAULTS.headerColor,
    accentColor: settings?.brandAccentColor || BRAND_COLOR_DEFAULTS.accentColor,
  };
}
