/**
 * Treemarkables depot. Shown on the job-map yard pin and used as the
 * address fallback when a Treemarkables document or email has no address
 * of its own. Other businesses keep whatever address they stored.
 *
 * Suburb and postcode are intentionally omitted.
 *
 * Coordinates are the LINZ street-address point 1570434. It was imported
 * into OpenStreetMap as node 5644893247 (user EliotB_linz, 2018-05-27)
 * and both Nominatim and Photon return that node for
 * "26 Cochrane Street, Gisborne, New Zealand":
 * https://www.openstreetmap.org/node/5644893247
 * https://nominatim.openstreetmap.org/search?format=jsonv2&q=26%20Cochrane%20Street%2C%20Gisborne%2C%20New%20Zealand
 */
import { TREEMARKABLES_BUSINESS_IDS } from "./roleChecklistAccess";

export const TREEMARKABLES_YARD_ADDRESS = "26 Cochrane Street, Gisborne";

export const TREEMARKABLES_YARD_LATITUDE = -38.657133;
export const TREEMARKABLES_YARD_LONGITUDE = 177.9878278;

export function isTreemarkablesBusiness(businessId: string | null | undefined): boolean {
  return !!businessId && TREEMARKABLES_BUSINESS_IDS.includes(businessId);
}

export function isTreemarkablesCompanyName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase().startsWith("treemarkables");
}

/** Stored address wins. A blank address falls back to the yard only for Treemarkables. */
export function fallbackCompanyAddress(
  companyName: string | null | undefined,
  companyAddress: string | null | undefined,
): string {
  const stored = (companyAddress ?? "").trim();
  if (stored) return stored;
  if (isTreemarkablesCompanyName(companyName)) return TREEMARKABLES_YARD_ADDRESS;
  return "";
}

/** Google Maps origin for the yard pin. Seven decimal places match the LINZ/OSM point. */
export function treemarkablesYardOrigin(): string {
  return `${TREEMARKABLES_YARD_LATITUDE.toFixed(7)},${TREEMARKABLES_YARD_LONGITUDE.toFixed(7)}`;
}

export function treemarkablesYardDirectionsUrl(jobAddress: string): string {
  const origin = treemarkablesYardOrigin();
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(jobAddress)}`;
}

export function treemarkablesYardDirectionsEmbedUrl(jobAddress: string): string {
  const origin = treemarkablesYardOrigin();
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${encodeURIComponent(jobAddress)}&output=embed`;
}
