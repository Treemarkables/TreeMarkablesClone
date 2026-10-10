/**
 * Live Roster day selection, as a Pacific/Auckland calendar key (YYYY-MM-DD).
 *
 * The key is the whole date. It is not a UTC instant. Two common conversions
 * shift it by a day around New Zealand:
 *
 * - `new Date('YYYY-MM-DD')` is UTC midnight. In any timezone behind UTC that
 *   instant is still the previous evening, so local getters return yesterday.
 * - `toISOString().slice(0, 10)` on NZ local midnight returns the previous UTC
 *   date (NZDT is UTC+13, so midnight is 11:00 UTC the day before).
 * - Noon UTC formatted in Pacific/Auckland is 1:00am the next day during
 *   daylight saving (UTC+13). A "noon UTC anchor" is only safe if you read the
 *   UTC calendar fields back, never the Auckland ones.
 *
 * Shifting uses UTC midnight plus `setUTCDate`, so a 23-hour or 25-hour NZ
 * daylight-saving day still moves exactly one calendar date.
 */

export const NZ_TZ = "Pacific/Auckland";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Rebuild a key from its UTC calendar fields. Overflow (31 Feb) does not match. */
export function rosterDateKeyRoundTrip(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isRosterDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  return rosterDateKeyRoundTrip(value) === value;
}

/** Calendar date of `now` in Pacific/Auckland. */
export function nzTodayKey(now: Date = new Date()): string {
  // en-CA is YYYY-MM-DD. timeZone does the NZ conversion; we never read the
  // host zone's local getters or toISOString().
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: NZ_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return isRosterDateKey(formatted) ? formatted : rosterDateKeyRoundTrip(formatted);
}

export function shiftDateKey(key: string, deltaDays: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week that contains `key`, as a date key. */
export function startOfIsoWeekKey(key: string): string {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return shiftDateKey(key, delta);
}

export function utcDayOfWeek(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcParts(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** "Saturday 10 October 2026" — the roster day heading. */
export function formatRosterDateLong(key: string): string {
  const d = utcParts(key);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "10 Oct" */
export function formatRosterDateDayMonth(key: string): string {
  const d = utcParts(key);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "10 Oct 2026" */
export function formatRosterDateDayMonthYear(key: string): string {
  const d = utcParts(key);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `?date=` from a location search string. Invalid or shifted values are ignored. */
export function rosterDateFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("date");
  return isRosterDateKey(raw) ? raw : null;
}

/** Search string with `date` set, other params kept. */
export function rosterSearchWithDate(search: string, dateKey: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("date", dateKey);
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function persistRosterDate(dateKey: string): void {
  if (typeof window === "undefined") return;
  const nextSearch = rosterSearchWithDate(window.location.search, dateKey);
  if (nextSearch === window.location.search) return;
  const next = window.location.pathname + nextSearch + window.location.hash;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Day-change swipe on the roster.
 * Returns +1 (next day), -1 (previous day), or 0 (ignore).
 *
 * Gestures that start on the open job card, or while it is open, must not
 * move the day. The card is rendered inside the swipe surface, so a horizontal
 * move while reading the job (tab strip, or the close/back gesture) otherwise
 * lands on the next day when the card closes.
 */
export function rosterDaySwipe(input: {
  startX: number | null;
  startY: number | null;
  endX: number;
  endY: number;
  scrollDelta: number;
  fromJobCard: boolean;
}): -1 | 0 | 1 {
  if (input.fromJobCard) return 0;
  if (input.startX === null || input.startY === null) return 0;
  // The timeline scrolls sideways on its own. A real scroll is not a day change.
  if (input.scrollDelta > 5) return 0;
  const deltaX = input.endX - input.startX;
  const deltaY = input.endY - input.startY;
  if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    return deltaX < 0 ? 1 : -1;
  }
  return 0;
}
