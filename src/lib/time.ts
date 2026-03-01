import { toZonedTime, format } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

// Default organization timezone
// In a real app, this should be fetched from the 'company_settings' table
export const ORG_TIMEZONE = 'Asia/Kolkata';

export function getOrgTime(date: Date | string | number = new Date()) {
  return toZonedTime(date, ORG_TIMEZONE);
}

export function getOrgDateString(date: Date | string | number = new Date()) {
  return format(toZonedTime(date, ORG_TIMEZONE), 'yyyy-MM-dd', { timeZone: ORG_TIMEZONE });
}

export function getOrgTimeStartOfDay(date: Date | string | number = new Date()) {
  const orgTime = toZonedTime(date, ORG_TIMEZONE);
  return startOfDay(orgTime);
}

export function getOrgTimeEndOfDay(date: Date | string | number = new Date()) {
  const orgTime = toZonedTime(date, ORG_TIMEZONE);
  return endOfDay(orgTime);
}

export function formatTime(date: Date | string | null) {
  if (!date) return '--:--';
  return format(toZonedTime(date, ORG_TIMEZONE), 'hh:mm a', { timeZone: ORG_TIMEZONE });
}
