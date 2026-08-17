/**
 * "Today" is resolved in the sport's own scheduling timezone (MLB: US Eastern),
 * not the server's. Vercel runs in UTC, so without this a click after 8pm ET
 * would ask for tomorrow's slate.
 */

export function todayInZone(timezone: string, now: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** e.g. "9:14 AM EDT" — when a card was generated, in the sport's timezone. */
export function formatTimeInZone(isoTimestamp: string, timezone: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** e.g. "Sunday, August 17, 2025" — for display only. */
export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
