import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Staff push-notification delivery window.
 *
 * Staff scheduling pushes (job assignments, schedule changes) may only be
 * delivered between 7am and 6pm NZ time, seven days a week. A push triggered
 * outside the window is queued in notification_queue and delivered by the
 * queue worker at the next 7am.
 */

const NZ_TIMEZONE = 'Pacific/Auckland';

export const STAFF_PUSH_WINDOW_START_HOUR = 7; // 7:00am NZ, inclusive
export const STAFF_PUSH_WINDOW_END_HOUR = 18; // 6:00pm NZ, exclusive

export function isWithinStaffPushWindow(now: Date = new Date()): boolean {
  const nzNow = toZonedTime(now, NZ_TIMEZONE);
  const hour = nzNow.getHours();
  return hour >= STAFF_PUSH_WINDOW_START_HOUR && hour < STAFF_PUSH_WINDOW_END_HOUR;
}

/**
 * The next 7am NZ as a UTC Date: today's 7am if we're before it (early
 * morning), otherwise tomorrow's. No weekend skip — the window runs every day.
 */
export function nextStaffPushWindowStart(now: Date = new Date()): Date {
  const nzNow = toZonedTime(now, NZ_TIMEZONE);
  const nextNz = new Date(nzNow);
  nextNz.setHours(STAFF_PUSH_WINDOW_START_HOUR, 0, 0, 0);
  if (nzNow.getHours() >= STAFF_PUSH_WINDOW_START_HOUR) {
    nextNz.setDate(nextNz.getDate() + 1);
  }
  return fromZonedTime(nextNz, NZ_TIMEZONE);
}
