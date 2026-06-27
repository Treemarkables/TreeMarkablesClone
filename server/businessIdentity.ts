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
  // No GST fallback: an unset business shows no GST line rather than leaking
  // Treemarkables' number. TM's own number lives on its settings row.
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
