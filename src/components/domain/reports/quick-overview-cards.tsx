import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import type { RentRollItem, AgedReceivableItem } from "@/server/actions/reports";

type QuickOverviewCardsProps = {
  rentRoll: RentRollItem[];
  agedReceivables: AgedReceivableItem[];
  locale: string;
};

export async function QuickOverviewCards({
  rentRoll,
  agedReceivables,
  locale,
}: QuickOverviewCardsProps) {
  const t = await getTranslations("reports");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Quick Rent Roll Preview */}
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("rentRoll")}</h2>
          <Link href="/reports/rent-roll" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {rentRoll.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("emptyRentRoll")}
          </p>
        ) : (
          <div className="divide-y divide-hairline">
            {rentRoll.slice(0, 5).map((r, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">
                    {r.building_code} — Unit {r.unit_no}
                  </span>
                  <span className="text-xs text-on-surface-variant">{r.tenant_name}</span>
                </div>
                <span className="font-semibold text-on-surface">
                  {formatMoney(BigInt(r.rent_minor), r.currency, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Aged Receivables Preview */}
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {t("agedReceivables")}
          </h2>
          <Link
            href="/reports/aged-receivables"
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {agedReceivables.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("emptyReceivables")}
          </p>
        ) : (
          <div className="divide-y divide-hairline">
            {agedReceivables.slice(0, 5).map((a, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">{a.tenant_name}</span>
                  <span className="text-xs text-on-surface-variant">
                    {a.days_overdue} days overdue (Due: {a.due_date})
                  </span>
                </div>
                <span className="font-semibold text-error">
                  {formatMoney(BigInt(a.amount_minor), a.currency, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
