/**
 * Business dates are `date` (no timezone); events are timestamptz in UTC.
 * All helpers work on ISO date strings (YYYY-MM-DD) to avoid Date/timezone drift.
 */
export function todayISO(timeZone = "Asia/Qatar"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsISO(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));
  target.setUTCDate(Math.min(day, lastDay.getUTCDate()));
  return target.toISOString().slice(0, 10);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: string): string {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...(from.split("-").map(Number) as [number, number, number]));
  const b = Date.UTC(...(to.split("-").map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

/** Period length in months for a lease payment frequency (SPEC 7.2). */
export const FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
} as const;

export type PaymentFrequency = keyof typeof FREQUENCY_MONTHS;
