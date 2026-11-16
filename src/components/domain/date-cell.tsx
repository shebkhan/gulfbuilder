import { getTranslations } from "next-intl/server";
import { daysUntil, formatDate } from "@/lib/dates";

type Props = {
  /** ISO date (YYYY-MM-DD) or ISO timestamp. */
  date: string;
  locale?: string;
  /** Add how many days are left until the date, or how long ago it was. */
  remaining?: boolean;
};

/**
 * A date in words with the days left until it. Past dates read as "12 days ago",
 * future ones as "45 days left", and the current day as "Today".
 */
export async function DateCell({ date, locale, remaining = false }: Props) {
  const t = await getTranslations("common");
  const formatted = formatDate(date, locale);

  if (!remaining) {
    return <span className="tabular">{formatted}</span>;
  }

  const days = daysUntil(date);
  const tone =
    days < 0
      ? "text-error"
      : days <= 30
        ? "text-on-surface-variant"
        : "text-secondary";
  const label =
    days === 0
      ? t("today")
      : days > 0
        ? t("daysLeft", { count: days })
        : t("daysAgo", { count: Math.abs(days) });

  return (
    <span className="flex flex-col">
      <span className="tabular">{formatted}</span>
      <span className={`font-body-sm text-body-sm ${tone}`}>{label}</span>
    </span>
  );
}
