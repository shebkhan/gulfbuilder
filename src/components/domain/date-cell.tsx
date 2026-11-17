import { daysUntil, formatDate } from "@/lib/dates";

type Props = {
  /** ISO date (YYYY-MM-DD) or ISO timestamp. */
  date: string;
  locale?: string;
};

/** A date in words, e.g. "16 Nov 2026". */
export function DateCell({ date, locale }: Props) {
  return <span className="tabular">{formatDate(date, locale)}</span>;
}

/**
 * The number of days until a date, negative once it has passed. The column heading
 * carries the meaning, so the cell only holds the number.
 */
export function DaysLeft({ date }: Props) {
  const days = daysUntil(date);
  const tone = days < 0 ? "text-error" : days <= 30 ? "text-on-surface-variant" : "text-secondary";
  return <span className={`tabular font-metric-num-sm text-metric-num-sm ${tone}`}>{days}</span>;
}
