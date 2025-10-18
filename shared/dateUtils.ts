/**
 * Timezone utilities for handling NZ (Pacific/Auckland) time conversions
 * 
 * Key concepts:
 * - Database stores all times in UTC
 * - NZ timezone is UTC+12 (standard) or UTC+13 (daylight saving)
 * - When displaying, we convert UTC → NZ local time
 * - When saving, we convert NZ local time → UTC
 */

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
  // Create a date string in ISO format without timezone
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;
  
  // Parse as if it's NZ time by using Intl.DateTimeFormat
  // This gives us the correct UTC timestamp for NZ local time
  const date = new Date(localDateTimeStr);
  
  // Get the timezone offset for NZ at this specific date (handles DST)
  const nzDate = new Date(date.toLocaleString('en-US', { timeZone: NZ_TIMEZONE }));
  const localDate = new Date(date.toLocaleString('en-US'));
  const offset = localDate.getTime() - nzDate.getTime();
  
  // Apply the offset to get the correct UTC time
  return new Date(date.getTime() - offset);
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
  const nzDateStr = utcDate.toLocaleString('en-NZ', {
    timeZone: NZ_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Parse the formatted string (format: "DD/MM/YYYY, HH:mm")
  const [datePart, timePart] = nzDateStr.split(', ');
  const [day, month, year] = datePart.split('/');
  
  return {
    date: `${year}-${month}-${day}`,
    time: timePart
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
