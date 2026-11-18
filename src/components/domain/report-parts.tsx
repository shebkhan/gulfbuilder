import { getTranslations } from "next-intl/server";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPagination } from "@/components/domain/list-pagination";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";
import { paginate } from "@/lib/pagination";
import type {
  ChequeReport,
  CollectionReport,
  ExpiryReport,
  OccupancyReport,
} from "@/server/actions/reports";

type BuildingOption = { id: string; code: string; name: string };

type FilterProps = {
  action: string;
  tab: string;
  from: string;
  to: string;
  building: string;
  buildings: BuildingOption[];
};

/** One filter bar shared by every report tab. Native GET form keeps links shareable. */
export async function ReportFilters({ action, tab, from, to, building, buildings }: FilterProps) {
  const t = await getTranslations("reports");
  const field =
    "h-10 rounded-xl border border-hairline bg-surface-container-lowest px-3 font-body-md text-body-md text-on-surface";

  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-4 shadow-card"
    >
      <input type="hidden" name="tab" value={tab} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from">{t("from")}</Label>
        <DatePicker id="from" name="from" defaultValue={from} className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to">{t("to")}</Label>
        <DatePicker id="to" name="to" defaultValue={to} className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="building">{t("building")}</Label>
        <Select name="building" defaultValue={building}>
          <SelectTrigger id="building" className={`${field} min-w-48`}>
            <SelectValue placeholder={t("allBuildings")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("allBuildings")}</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.code} — {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">{t("apply")}</Button>
    </form>
  );
}

export function ReportStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1 p-5">
        <KpiLabel>{label}</KpiLabel>
        <span className="font-headline-md text-headline-md font-bold text-on-surface">{value}</span>
        {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
      </CardBody>
    </Card>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const tableClass = "w-full border-collapse text-start font-body-sm text-body-sm";
const headRow =
  "border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant";
const cell = "p-4";

export async function OccupancyView({
  report,
  locale,
}: {
  report: OccupancyReport;
  locale: string;
}) {
  const t = await getTranslations("reports");
  const currency = (await getOrgContext())?.currency ?? "QAR";
  const { occupancy, value, perBuilding } = report;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat
          label={t("occupancyRate")}
          value={`${occupancy.occupancyPct}%`}
          hint={`${occupancy.occupied} / ${occupancy.total}`}
        />
        <ReportStat label={t("vacantUnits")} value={occupancy.vacant} />
        <ReportStat
          label={t("gpr")}
          value={formatMoney(BigInt(value.gpr), currency, locale)}
          hint={t("egiHint")}
        />
        <ReportStat
          label={t("vacancyLoss")}
          value={formatMoney(BigInt(value.vacancyLoss), currency, locale)}
        />
      </div>

      {perBuilding.length === 0 ? (
        <p className="p-12 text-center text-on-surface-variant">{t("noReportData")}</p>
      ) : (
        <TableShell>
          <table className={tableClass}>
            <thead>
              <tr className={headRow}>
                <th className={cell}>{t("property")}</th>
                <th className={cell}>{t("occupancyRate")}</th>
                <th className={cell}>{t("unit")}</th>
                <th className={`${cell} text-end`}>{t("gpr")}</th>
                <th className={`${cell} text-end`}>{t("vacancyLoss")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {perBuilding.map((b) => (
                <tr key={b.id} className="hover:bg-surface-container-low/50">
                  <td className={`${cell} font-medium text-on-surface`}>
                    {b.code} — {b.name}
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-28 overflow-hidden rounded-full bg-surface-container-high"
                        aria-label={`${b.occupied} / ${b.total}`}
                      >
                        <div
                          className="h-full bg-secondary"
                          style={{ width: `${b.occupancyPct}%` }}
                        />
                      </div>
                      <span className="tabular text-on-surface-variant">{b.occupancyPct}%</span>
                    </div>
                  </td>
                  <td className={`${cell} text-on-surface-variant`}>
                    {b.occupied} / {b.total} ({b.vacant} {t("vacantUnits")})
                  </td>
                  <td className={`${cell} text-end text-on-surface`}>
                    {formatMoney(BigInt(b.gpr), currency, locale)}
                  </td>
                  <td className={`${cell} text-end text-error`}>
                    {formatMoney(BigInt(b.vacancyLoss), currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}

export async function ExpiryView({
  report,
  locale,
  page,
  href,
  params,
}: {
  report: ExpiryReport;
  locale: string;
  page: number;
  href: string;
  params: Record<string, string | undefined>;
}) {
  const t = await getTranslations("reports");
  const currency = (await getOrgContext())?.currency ?? "QAR";
  const tc = await getTranslations("common");
  const paged = paginate(report.rows, page);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <ReportStat label={t("expiring30")} value={report.buckets.d30} />
        <ReportStat label={t("expiring60")} value={report.buckets.d60} />
        <ReportStat label={t("expiring90")} value={report.buckets.d90} />
        <ReportStat
          label={t("renewalRate")}
          value={`${report.renewalRate}%`}
          hint={`${report.renewed} / ${report.renewed + report.expired}`}
        />
        <ReportStat
          label={t("monthlyRentRoll")}
          value={formatMoney(
            BigInt(report.rows.reduce((sum, row) => sum + row.rent_minor, 0)),
            currency,
            locale,
          )}
        />
      </div>

      {paged.rows.length === 0 ? (
        <p className="p-12 text-center text-on-surface-variant">{t("noReportData")}</p>
      ) : (
        <>
          <TableShell>
            <table className={tableClass}>
              <thead>
                <tr className={headRow}>
                  <th className={cell}>{t("property")}</th>
                  <th className={cell}>{t("unit")}</th>
                  <th className={cell}>{t("tenant")}</th>
                  <th className={cell}>{t("endDate")}</th>
                  <th className={cell}>{tc("daysLeftHeader")}</th>
                  <th className={`${cell} text-end`}>{t("rent")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {paged.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50">
                    <td className={`${cell} font-medium text-on-surface`}>{row.building_name}</td>
                    <td className={`${cell} text-on-surface`}>{row.unit_no}</td>
                    <td className={`${cell} text-on-surface`}>{row.tenant_name}</td>
                    <td className={`${cell} text-on-surface-variant`}>
                      <DateCell date={row.end_date} locale={locale} />
                    </td>
                    <td className={cell}>
                      <DaysLeft date={row.end_date} />
                    </td>
                    <td className={`${cell} text-end font-semibold text-on-surface`}>
                      {formatMoney(BigInt(row.rent_minor), row.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href={href}
            params={params}
          />
        </>
      )}
    </div>
  );
}

export async function CollectionView({
  report,
  locale,
}: {
  report: CollectionReport;
  locale: string;
}) {
  const t = await getTranslations("reports");
  const currency = (await getOrgContext())?.currency ?? "QAR";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat label={t("billed")} value={formatMoney(BigInt(report.billed), currency, locale)} />
        <ReportStat
          label={t("collected")}
          value={formatMoney(BigInt(report.collected), currency, locale)}
        />
        <ReportStat
          label={t("outstanding")}
          value={formatMoney(BigInt(report.outstanding), currency, locale)}
        />
        <ReportStat
          label={t("averageDaysToPay")}
          value={report.averageDaysToPay ?? "—"}
          hint={`${report.rate}% ${t("collectionRate")}`}
        />
      </div>

      {report.perBuilding.length === 0 ? (
        <p className="p-12 text-center text-on-surface-variant">{t("noReportData")}</p>
      ) : (
        <TableShell>
          <table className={tableClass}>
            <thead>
              <tr className={headRow}>
                <th className={cell}>{t("property")}</th>
                <th className={`${cell} text-end`}>{t("billed")}</th>
                <th className={`${cell} text-end`}>{t("collected")}</th>
                <th className={`${cell} text-end`}>{t("outstanding")}</th>
                <th className={`${cell} text-end`}>{t("collectionRate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {report.perBuilding.map((row) => (
                <tr key={row.building_code} className="hover:bg-surface-container-low/50">
                  <td className={`${cell} font-medium text-on-surface`}>
                    {row.building_code} — {row.building_name}
                  </td>
                  <td className={`${cell} text-end text-on-surface`}>
                    {formatMoney(BigInt(row.billed), currency, locale)}
                  </td>
                  <td className={`${cell} text-end text-on-surface`}>
                    {formatMoney(BigInt(row.collected), currency, locale)}
                  </td>
                  <td className={`${cell} text-end text-error`}>
                    {formatMoney(BigInt(row.outstanding), currency, locale)}
                  </td>
                  <td className={`${cell} tabular text-end text-on-surface-variant`}>
                    {row.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}

export async function ChequeView({
  report,
  locale,
  page,
  href,
  params,
}: {
  report: ChequeReport;
  locale: string;
  page: number;
  href: string;
  params: Record<string, string | undefined>;
}) {
  const t = await getTranslations("reports");
  const currency = (await getOrgContext())?.currency ?? "QAR";
  const paged = paginate(report.rows, page);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportStat
          label={t("dueThisWeek")}
          value={formatMoney(BigInt(report.dueThisWeek.amount), currency, locale)}
          hint={`${report.dueThisWeek.count} ${t("cheques")}`}
        />
        <ReportStat
          label={t("dueThisMonth")}
          value={formatMoney(BigInt(report.dueThisMonth.amount), currency, locale)}
          hint={`${report.dueThisMonth.count} ${t("cheques")}`}
        />
        <ReportStat
          label={t("atRisk")}
          value={formatMoney(BigInt(report.atRisk.amount), currency, locale)}
          hint={`${report.atRisk.count} ${t("cheques")}`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {report.byStatus.map((entry) => (
          <Badge key={entry.status} variant="neutral">
            {entry.status.replace(/_/g, " ")} · {entry.count} ·{" "}
            {formatMoney(BigInt(entry.amount), currency, locale)}
          </Badge>
        ))}
      </div>

      {paged.rows.length === 0 ? (
        <p className="p-12 text-center text-on-surface-variant">{t("noReportData")}</p>
      ) : (
        <>
          <TableShell>
            <table className={tableClass}>
              <thead>
                <tr className={headRow}>
                  <th className={cell}>{t("cheque")}</th>
                  <th className={cell}>{t("bank")}</th>
                  <th className={cell}>{t("tenant")}</th>
                  <th className={cell}>{t("date")}</th>
                  <th className={cell}>{t("status")}</th>
                  <th className={`${cell} text-end`}>{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {paged.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50">
                    <td className={`${cell} font-medium text-on-surface`}>#{row.cheque_no}</td>
                    <td className={`${cell} text-on-surface`}>{row.bank_name}</td>
                    <td className={`${cell} text-on-surface`}>{row.tenant_name}</td>
                    <td className={`${cell} text-on-surface-variant`}>
                      <DateCell date={row.cheque_date} locale={locale} />
                    </td>
                    <td className={cell}>
                      <Badge variant={row.status === "cleared" ? "success" : "neutral"}>
                        {row.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className={`${cell} text-end font-semibold text-on-surface`}>
                      {formatMoney(BigInt(row.amount_minor), row.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href={href}
            params={params}
          />
        </>
      )}
    </div>
  );
}
