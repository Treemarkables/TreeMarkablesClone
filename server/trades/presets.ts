/**
 * Inflow — Trade presets (Trade Generalization Phase B, foundation).
 *
 * Code-defined registry of the per-trade "seed packs": the job types, equipment
 * types, staff positions, and AI vocabulary a trade works from. A business picks
 * an `industry` (businessSettings.industry); the preset provides the defaults.
 * Code is the source of truth (mirrors capabilities.ts) — adding a trade is one
 * object, no schema or route change.
 *
 * `tree` reproduces Treemarkables' current hardcoded arborist lists verbatim, so
 * the live business is unchanged. Unknown / unset industry → `general` (generic
 * field-service) so onboarding is never blocked on preset coverage.
 *
 * STATUS: registry + lookup only. Consumers (AI prompts → aiVocabulary, catalog
 * seeding → serviceTypes/equipmentTypes/staffPositions) wire to this in later
 * slices. See INFLOW_TRADE_GENERALIZATION_PLAN.md (Phase B).
 */

export interface TradePreset {
  key: string;
  label: string;
  /** For AI prompts: "a New Zealand {discipline} business". */
  discipline: string;
  /** Trade terms to steer speech-to-quote / extraction prompts. */
  aiVocabulary: string;
  serviceTypes: string[];
  equipmentTypes: string[];
  staffPositions: string[];
}

export const TRADE_PRESETS: Record<string, TradePreset> = {
  // Treemarkables' current arborist lists — keep verbatim so the live business
  // is unchanged when industry='tree' (the default).
  tree: {
    key: "tree",
    label: "Tree services",
    discipline: "arborist",
    aiVocabulary:
      "dismantle, stump grind, mulch, chip, firewood lengths, cleanup, crown reduction, deadwooding, hedge trimming, felling",
    serviceTypes: ["tree_removal", "pruning", "hedge_trimming", "stump_grinding", "mulch", "emergency", "other"],
    equipmentTypes: ["chainsaw", "chipper", "stump_grinder", "ewp", "rigging", "vehicle"],
    staffPositions: ["arborist", "ground_crew", "foreman", "driver"],
  },
  plumbing: {
    key: "plumbing",
    label: "Plumbing",
    discipline: "plumbing",
    aiVocabulary:
      "rough-in, PEX, copper, hot-water cylinder, backflow, isolation valve, drainage, jetting, blocked drain, mixer, trap",
    serviceTypes: ["new_install", "repair", "drainage", "hot_water", "blocked_drain", "maintenance", "other"],
    equipmentTypes: ["van", "drain_camera", "jetter", "pipe_locator", "hand_tools", "power_tools"],
    staffPositions: ["plumber", "apprentice", "drainlayer", "estimator", "office"],
  },
  electrical: {
    key: "electrical",
    label: "Electrical",
    discipline: "electrical",
    aiVocabulary:
      "switchboard, RCD, circuit, three-phase, cabling, mains, EV charger, fault finding, testing, lighting, GPO",
    serviceTypes: ["new_install", "repair", "switchboard", "lighting", "ev_charger", "fault_finding", "maintenance", "other"],
    equipmentTypes: ["van", "multimeter", "cable_tools", "drill", "ladder", "test_equipment"],
    staffPositions: ["electrician", "apprentice", "estimator", "office"],
  },
  building: {
    key: "building",
    label: "Building",
    discipline: "building",
    aiVocabulary:
      "framing, cladding, foundations, gib, decking, joinery, weatherboard, subfloor, renovation, fixings, bracing",
    serviceTypes: ["new_build", "renovation", "deck", "fencing", "repair", "maintenance", "other"],
    equipmentTypes: ["van", "power_tools", "scaffold", "nail_gun", "saws", "hand_tools"],
    staffPositions: ["builder", "apprentice", "labourer", "foreman", "estimator", "office"],
  },
  // Fallback for any trade without a tailored preset — never blocks onboarding.
  general: {
    key: "general",
    label: "General field services",
    discipline: "field services",
    aiVocabulary: "",
    serviceTypes: ["install", "repair", "maintenance", "callout", "other"],
    equipmentTypes: ["van", "hand_tools", "power_tools"],
    staffPositions: ["technician", "apprentice", "office"],
  },
};

/** Resolve a business's industry key to its preset. Default 'tree' (matches the
 *  schema default → Treemarkables unchanged); unknown key → 'general'. */
export function getTradePreset(industry?: string | null): TradePreset {
  if (!industry) return TRADE_PRESETS.tree;
  return TRADE_PRESETS[industry] ?? TRADE_PRESETS.general;
}

/** The trade keys offered at signup (in display order). */
export const TRADE_KEYS = ["tree", "plumbing", "electrical", "building", "general"] as const;
