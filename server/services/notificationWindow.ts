import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { storage } from '../storage.js';

/**
 * Staff push-notification delivery window ("quiet hours").
 *
 * Staff scheduling pushes (job assignments, schedule changes) may only be
 * delivered inside the tenant's configured window (business_settings:
 * staff_push_window_enabled/start/end, NZ time, every day). A push triggered
 * outside the window is queued in notification_queue and delivered by the
 * queue worker at the next window start. Disabling the window sends pushes
 * immediately around the clock.
 */

const NZ_TIMEZONE = 'Pacific/Auckland';

export interface StaffPushWindow {
  enabled: boolean;
  startMinutes: number; // minutes since midnight NZ, inclusive
  endMinutes: number; // minutes since midnight NZ, exclusive
}

export const DEFAULT_STAFF_PUSH_WINDOW: StaffPushWindow = {
  enabled: true,
  startMinutes: 7 * 60, // 7:00am
  endMinutes: 18 * 60, // 6:00pm
};

function parseHHMM(value: string | null | undefined): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Resolve the tenant's configured window from business settings. Call from
 * request context (getBusinessSettings is tenant-scoped via ALS). Any
 * missing/invalid config — including start === end, which would mean an
 * empty window that never delivers — falls back to the 7am-6pm default.
 */
export async function getStaffPushWindow(): Promise<StaffPushWindow> {
  try {
    const settings = await storage.getBusinessSettings();
    const startMinutes = parseHHMM(settings?.staffPushWindowStart);
    const endMinutes = parseHHMM(settings?.staffPushWindowEnd);
    const enabled = settings?.staffPushWindowEnabled !== false;
    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
      return { ...DEFAULT_STAFF_PUSH_WINDOW, enabled };
    }
    return { enabled, startMinutes, endMinutes };
  } catch (error) {
    console.error('Error resolving staff push window, using defaults:', error);
    return DEFAULT_STAFF_PUSH_WINDOW;
  }
}

function nzMinutesOfDay(now: Date): number {
  const nzNow = toZonedTime(now, NZ_TIMEZONE);
  return nzNow.getHours() * 60 + nzNow.getMinutes();
}

export function isWithinStaffPushWindow(window: StaffPushWindow, now: Date = new Date()): boolean {
  if (!window.enabled) return true;
  const nowMin = nzMinutesOfDay(now);
  if (window.startMinutes < window.endMinutes) {
    return nowMin >= window.startMinutes && nowMin < window.endMinutes;
  }
  // start > end wraps past midnight (e.g. 20:00-06:00) — tolerated even
  // though the settings UI enforces start < end.
  return nowMin >= window.startMinutes || nowMin < window.endMinutes;
}

/**
 * The next window start in NZ as a UTC Date: today's start time if we're
 * before it, otherwise tomorrow's. (Only meaningful when currently outside
 * the window — for a wrapped window "outside" always sits before today's
 * start, so the same rule holds.)
 */
export function nextStaffPushWindowStart(window: StaffPushWindow, now: Date = new Date()): Date {
  const nzNow = toZonedTime(now, NZ_TIMEZONE);
  const nextNz = new Date(nzNow);
  nextNz.setHours(Math.floor(window.startMinutes / 60), window.startMinutes % 60, 0, 0);
  if (nzMinutesOfDay(now) >= window.startMinutes) {
    nextNz.setDate(nextNz.getDate() + 1);
  }
  return fromZonedTime(nextNz, NZ_TIMEZONE);
}
