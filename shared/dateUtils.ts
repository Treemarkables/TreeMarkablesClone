/**
 * Timezone utilities for handling NZ (Pacific/Auckland) time conversions
 * 
 * Key concepts:
 * - Database stores all times in UTC
 * - NZ timezone is UTC+12 (standard) or UTC+13 (daylight saving)
 * - When displaying, we convert UTC → NZ local time
 * - When saving, we convert NZ local time → UTC
 */

import { fromZonedTime, toZonedTime, format as formatTz } from 'date-fns-tz';

const NZ_TIMEZONE = 'Pacific/Auckland';

/**
 * Convert a date string in NZ local time to UTC Date object
 * Use this when SAVING times from the UI to the database
 * 
 * @param dateStr - Date string in format "YYYY-MM-DD"
 * @param timeStr - Time string in format "HH:mm"
 * @returns Date object in UTC
 * 
 * @example
 * // User selects 10:00 AM on Oct 17, 2025 in NZ
 * nzTimeToUTC('2025-10-17', '10:00')
 * // Returns Date object representing 2025-10-16T21:00:00.000Z (UTC)
 */
export function nzTimeToUTC(dateStr: string, timeStr: string): Date {
  // Create a date string representing the wall-clock time in NZ
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;
  
  // Use date-fns-tz to properly convert NZ time to UTC
  // This handles DST automatically and avoids double conversion
  return fromZonedTime(localDateTimeStr, NZ_TIMEZONE);
}

/**
 * Convert a UTC Date object to NZ local time components
 * Use this when DISPLAYING times from the database in the UI
 * 
 * @param utcDate - Date object in UTC (from database)
 * @returns Object with date and time in NZ timezone
 * 
 * @example
 * // Database has 2025-10-16T21:00:00.000Z (UTC)
 * utcToNZTime(new Date('2025-10-16T21:00:00.000Z'))
 * // Returns { date: '2025-10-17', time: '10:00' }
 */
export function utcToNZTime(utcDate: Date): { date: string; time: string } {
  // Use formatTz to format the UTC date directly in NZ timezone
  // This avoids double conversion issues
  const dateStr = formatTz(utcDate, 'yyyy-MM-dd', { timeZone: NZ_TIMEZONE });
  const timeStr = formatTz(utcDate, 'HH:mm', { timeZone: NZ_TIMEZONE });
  
  return {
    date: dateStr,
    time: timeStr
  };
}

/**
 * Format a UTC date for display in NZ timezone
 * 
 * @param utcDate - Date object or ISO string in UTC
 * @param format - 'date' | 'time' | 'datetime' | 'full'
 * @returns Formatted string in NZ timezone
 */
export function formatNZTime(
  utcDate: Date | string,
  format: 'date' | 'time' | 'datetime' | 'full' = 'datetime'
): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: NZ_TIMEZONE,
  };
  
  switch (format) {
    case 'date':
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
      break;
    case 'datetime':
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
      break;
    case 'full':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
      options.weekday = 'long';
      break;
  }
  
  return date.toLocaleString('en-NZ', options);
}

/**
 * Get current date/time in NZ timezone
 */
export function getNZNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: NZ_TIMEZONE }));
}

/**
 * Check if a date is in the past (in NZ timezone)
 */
export function isInPastNZ(date: Date): boolean {
  const now = getNZNow();
  return date < now;
}

/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 * @param time24 - Time string in 24-hour format (e.g., "10:00", "14:30")
 * @returns Time string in 12-hour format with AM/PM (e.g., "10:00 AM", "2:30 PM")
 */
export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  
  const [hoursStr, minutesStr] = time24.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${hours12}:${minutes} ${period}`;
}

/**
 * TIMEZONE-AWARE COMPARISON HELPERS
 * Use these instead of direct date comparisons to ensure NZ timezone correctness
 */

/**
 * Check if two UTC dates represent the same calendar day in NZ timezone
 * USE THIS instead of date-fns isSameDay() for database dates
 * 
 * @param utcDate1 - First date in UTC (from database or ISO string)
 * @param utcDate2 - Second date in UTC (from database or ISO string) 
 * @returns true if both dates are the same calendar day in NZ
 * 
 * @example
 * // Database has: 2025-11-06T13:00:00.000Z
 * // This is Nov 7, 2:00 AM in NZ (UTC+13)
 * const dbDate = new Date('2025-11-06T13:00:00.000Z');
 * const selectedDate = new Date('2025-11-07'); // User selected Nov 7
 * isSameDayNZ(dbDate, selectedDate); // true ✅
 * // Using regular isSameDay would return false ❌
 */
export function isSameDayNZ(utcDate1: Date | string, utcDate2: Date | string): boolean {
  const date1 = typeof utcDate1 === 'string' ? new Date(utcDate1) : utcDate1;
  const date2 = typeof utcDate2 === 'string' ? new Date(utcDate2) : utcDate2;
  
  // Convert both dates to NZ timezone
  const nz1 = utcToNZTime(date1);
  const nz2 = utcToNZTime(date2);
  
  // Compare just the date parts
  return nz1.date === nz2.date;
}

/**
 * Parse a UTC date string/Date safely for display
 * Use this when you need to work with dates from the database
 * 
 * @param utcValue - Date string or Date object from database
 * @returns Date object (guaranteed valid or null)
 */
export function parseUTCDate(utcValue: Date | string | null | undefined): Date | null {
  if (!utcValue) return null;
  
  const date = typeof utcValue === 'string' ? new Date(utcValue) : utcValue;
  
  // Check if valid
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Get NZ date string from UTC date for comparison
 * USE THIS when filtering/comparing dates by calendar day
 * 
 * @param utcDate - UTC date from database
 * @returns Date string in YYYY-MM-DD format (NZ timezone)
 * 
 * @example
 * const dbDate = new Date('2025-11-06T13:00:00.000Z');
 * getNZDateString(dbDate); // '2025-11-07' (NZ time)
 */
export function getNZDateString(utcDate: Date | string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const nzTime = utcToNZTime(date);
  return nzTime.date;
}

/**
 * Check if a UTC date falls within a date range in NZ timezone
 * 
 * @param utcDate - The date to check (from database)
 * @param startDate - Range start (in NZ timezone as Date or YYYY-MM-DD string)
 * @param endDate - Range end (in NZ timezone as Date or YYYY-MM-DD string)
 * @returns true if the date falls within the range in NZ timezone
 */
export function isBetweenNZ(
  utcDate: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const nzDateStr = getNZDateString(utcDate);
  const start = typeof startDate === 'string' ? startDate : getNZDateString(startDate);
  const end = typeof endDate === 'string' ? endDate : getNZDateString(endDate);

  return nzDateStr >= start && nzDateStr <= end;
}

/** A job's scheduling fields as far as the date helpers care. */
export interface JobScheduleLike {
  scheduledDate?: Date | string | null;
  scheduledEndDate?: Date | string | null;
  scheduledDates?: string[] | null;
}

/**
 * The set of NZ calendar dates (YYYY-MM-DD, sorted ascending) a job actually
 * runs on.
 *
 * Honours an explicit `scheduledDates` array when present — this lets a multi-day
 * booking skip days inside its span (e.g. Wednesday–Monday excluding the weekend).
 * Otherwise it falls back to the contiguous scheduledDate..scheduledEndDate span,
 * or to the single scheduledDate when there's no end date.
 */
export function getJobScheduledNZDates(job: JobScheduleLike): string[] {
  if (Array.isArray(job.scheduledDates) && job.scheduledDates.length > 0) {
    return [...job.scheduledDates].sort();
  }
  if (!job.scheduledDate) return [];
  const start = getNZDateString(job.scheduledDate);
  if (!job.scheduledEndDate) return [start];
  const end = getNZDateString(job.scheduledEndDate);
  if (end <= start) return [start];

  // Noon-UTC anchoring avoids DST boundary drift while iterating day-by-day.
  const days: string[] = [];
  const d = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (d <= last) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/**
 * Whether a job runs on a given NZ calendar date. Respects an explicit
 * non-contiguous `scheduledDates` set, so excluded days (e.g. weekends carved
 * out of a span) correctly return false.
 *
 * `date` may be a UTC Date/ISO string (converted to its NZ calendar date) or an
 * already-NZ YYYY-MM-DD string.
 */
export function jobRunsOnNZDate(job: JobScheduleLike, date: Date | string): boolean {
  const nzDateStr =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getNZDateString(date);
  return getJobScheduledNZDates(job).includes(nzDateStr);
}
