/**
 * Locked job-level heavy plant catalogue (Jullian).
 *
 * Equipment is shared on the job — selected when quoting / on the job card —
 * not a per-person kit list. Persist exact labels on `jobs.equipment`.
 * UI copy uses spaces only (no hyphens).
 */

export const JOB_EQUIPMENT_CATALOGUE = [
  { id: "bucket_truck", label: "bucket truck" },
  { id: "big_truck", label: "big truck" },
  { id: "chipper", label: "chipper" },
  { id: "big_stump_grinder", label: "big stump grinder" },
  { id: "small_stump_grinder", label: "small stump grinder" },
  { id: "orchard_ladder", label: "orchard ladder" },
] as const;

export type JobEquipmentId = (typeof JOB_EQUIPMENT_CATALOGUE)[number]["id"];
export type JobEquipmentLabel = (typeof JOB_EQUIPMENT_CATALOGUE)[number]["label"];

export const JOB_EQUIPMENT_LABELS: JobEquipmentLabel[] = JOB_EQUIPMENT_CATALOGUE.map(
  (item) => item.label,
);

type CatalogueMatcher = {
  id: JobEquipmentId;
  label: JobEquipmentLabel;
  needle: string;
  idNeedle: string;
};

function normalizeEquipmentToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longer labels first so "big stump grinder" wins a contains-match over nothing else. */
const MATCHERS: CatalogueMatcher[] = JOB_EQUIPMENT_CATALOGUE.map((item) => ({
  id: item.id,
  label: item.label,
  needle: normalizeEquipmentToken(item.label),
  idNeedle: normalizeEquipmentToken(item.id),
})).sort((a, b) => b.needle.length - a.needle.length);

export function resolveJobEquipmentLabel(raw: string): JobEquipmentLabel | null {
  const normalized = normalizeEquipmentToken(raw);
  if (!normalized) return null;
  for (const matcher of MATCHERS) {
    if (normalized === matcher.needle || normalized === matcher.idNeedle) {
      return matcher.label;
    }
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(matcher.needle)}(?:\\s|$)`);
    if (pattern.test(normalized)) return matcher.label;
  }
  return null;
}

/** Keep only catalogue items, de-duped, in locked catalogue order. */
export function sanitizeJobEquipment(input: unknown): JobEquipmentLabel[] {
  const seen = new Set<JobEquipmentLabel>();
  if (!Array.isArray(input)) return [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    const label = resolveJobEquipmentLabel(value);
    if (label) seen.add(label);
  }
  return JOB_EQUIPMENT_LABELS.filter((label) => seen.has(label));
}

export function toggleJobEquipment(
  selected: readonly string[],
  label: JobEquipmentLabel,
): JobEquipmentLabel[] {
  const current = new Set(sanitizeJobEquipment([...selected]));
  if (current.has(label)) current.delete(label);
  else current.add(label);
  return JOB_EQUIPMENT_LABELS.filter((item) => current.has(item));
}
