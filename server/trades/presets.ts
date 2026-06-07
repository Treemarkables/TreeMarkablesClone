/**
 * Inflow — Trade presets (Trade Generalization Phase B/C).
 *
 * A code-defined registry of the per-trade catalogs and AI vocabulary a business
 * starts from. The `businessSettings.industry` key selects a preset; its contents
 * seed editable per-business catalogs at signup (Phase B) and feed the AI context
 * builder at call time (Phase C). Adding a trade = adding one object here — no
 * schema or route changes (never branch on `industry` in route logic).
 *
 * `tree` reproduces Treemarkables' current arborist lists verbatim, so the live
 * business is unchanged. Unknown/missing key falls back to `general`.
 * See INFLOW_TRADE_GENERALIZATION_PLAN.md.
 */

export interface TradePreset {
  key: string;
  label: string;
  discipline: string;        // default businessDiscipline → "a New Zealand {discipline} business"
  serviceTypes: string[];    // job/service categories
  equipmentTypes: string[];  // equipment register types
  staffPositions: string[];  // staff role/position types
  aiVocabulary: string;      // domain terms injected into AI prompts (speech-to-quote, extraction)
  whisperBias: string;       // 224-token vocabulary hint biasing Whisper transcription toward trade terms
}

export const TRADE_PRESETS: Record<string, TradePreset> = {
  tree: {
    key: "tree",
    label: "Tree services",
    discipline: "arborist",
    serviceTypes: ["tree_removal", "pruning", "stump_grinding", "hedge_trimming", "crown_reduction", "mulch_delivery", "planting", "consultation", "storm_cleanup", "other"],
    // Matches the current Equipment.tsx filter list verbatim so TM's dropdown is unchanged.
    equipmentTypes: ["bucket_truck", "chainsaw", "chipper", "stump_grinder", "safety_gear", "crane", "dump_truck", "generator", "wood_splitter"],
    staffPositions: ["arborist", "ground_crew", "foreman", "driver", "office"],
    aiVocabulary: "tree removal, dismantle, stump grind, mulch, chip, firewood lengths, pruning, hedge trimming, crown reduction, rigging, cleanup",
    // Verbatim of the previous hardcoded WHISPER_BIAS_PROMPT — keeps TM byte-identical.
    whisperBias:
      "New Zealand tree services walkthrough. Species: pohutukawa, manuka, kanuka, kauri, totara, rimu, kahikatea, miro, tawa, rewarewa, kowhai, ribbonwood, pittosporum, cabbage tree, ti kouka, gleditsia, magnolia, oak, pine, eucalyptus, gum tree, macrocarpa, leyland cypress, willow, poplar, silver birch, plum. Operations: prune, lift, crown reduction, deadwood, remove, fell, dismantle, stump grind, mulch, chip, firewood lengths, cleanup.",
  },
  plumbing: {
    key: "plumbing",
    label: "Plumbing",
    discipline: "plumbing",
    serviceTypes: ["new_install", "repair", "drainage", "hot_water", "blocked_drain", "gas_fitting", "maintenance", "other"],
    equipmentTypes: ["van", "drain_camera", "jetter", "pipe_locator", "hand_tools", "power_tools"],
    staffPositions: ["plumber", "apprentice", "drainlayer", "gasfitter", "estimator", "office"],
    aiVocabulary: "rough-in, PEX, copper pipe, hot-water cylinder, backflow, isolation valve, drainage, jetting, blocked drain, tap, mixer, toilet, cistern",
    whisperBias:
      "New Zealand plumbing job walkthrough. Work: rough-in, PEX, copper, hot-water cylinder, backflow, isolation valve, blocked drain, jetting, drain camera, tap, mixer, toilet, cistern, drainage, leak, gas fitting, repair, install, maintenance.",
  },
  electrical: {
    key: "electrical",
    label: "Electrical",
    discipline: "electrical",
    serviceTypes: ["new_install", "repair", "switchboard", "lighting", "ev_charger", "fault_finding", "inspection", "maintenance", "other"],
    equipmentTypes: ["van", "multimeter", "cable_locator", "test_equipment", "ladder", "hand_tools", "power_tools"],
    staffPositions: ["electrician", "apprentice", "estimator", "office"],
    aiVocabulary: "switchboard, circuit, RCD, MCB, wiring, power point, lighting, EV charger, fault finding, three-phase, cabling, certificate of compliance",
    whisperBias:
      "New Zealand electrical job walkthrough. Work: switchboard, circuit, RCD, MCB, wiring, power point, GPO, lighting, EV charger, fault finding, three-phase, cabling, certificate of compliance, install, repair, inspection.",
  },
  building: {
    key: "building",
    label: "Building & construction",
    discipline: "building",
    serviceTypes: ["new_build", "renovation", "deck", "fencing", "concrete", "repair", "maintenance", "other"],
    equipmentTypes: ["ute", "trailer", "scaffold", "nail_gun", "saw", "hand_tools", "power_tools"],
    staffPositions: ["builder", "carpenter", "apprentice", "labourer", "foreman", "estimator", "office"],
    aiVocabulary: "framing, plasterboard, cladding, decking, foundation, concrete, fixings, joinery, weathertightness, building consent",
    whisperBias:
      "New Zealand building job walkthrough. Work: framing, plasterboard, gib, cladding, decking, foundation, concrete, fixings, joinery, weathertightness, renovation, fencing, repair, build.",
  },
  general: {
    key: "general",
    label: "General field service",
    discipline: "field service",
    serviceTypes: ["install", "repair", "maintenance", "inspection", "callout", "other"],
    equipmentTypes: ["vehicle", "hand_tools", "power_tools", "equipment"],
    staffPositions: ["technician", "apprentice", "supervisor", "estimator", "office"],
    aiVocabulary: "installation, repair, maintenance, callout, parts, labour, service, inspection",
    whisperBias:
      "New Zealand field-service job walkthrough. Work: installation, repair, maintenance, callout, parts, labour, service, inspection, replace, fault.",
  },
};

export const DEFAULT_INDUSTRY = "tree"; // matches businessSettings.industry default (preserves TM)

/**
 * Resolve an industry key to its preset (never throws).
 * - missing/empty → `tree` (preserves existing rows + Treemarkables, matching the column default)
 * - a set-but-unknown key → `general` (neutral fallback so the app is never blocked)
 */
export function getTradePreset(industry?: string | null): TradePreset {
  if (!industry) return TRADE_PRESETS[DEFAULT_INDUSTRY];
  return TRADE_PRESETS[industry] || TRADE_PRESETS.general;
}

export const ALL_TRADE_PRESETS: TradePreset[] = Object.values(TRADE_PRESETS);
