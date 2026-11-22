import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnerScope } from "@/server/queries/owner-portal";
import { OwnerStatementPdfButton } from "@/components/domain/owner-statement-pdf-button";

export default async function OwnerStatementPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner.statements");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const supabase = await createSupabaseServerClient();
  const { data: statement } = await supabase
    .from("owner_statements")
    .select("id, owner_id, period_start, period_end, currency, status, opening_minor, closing_minor, totals, lines, issued_at")
    .eq("id", id)
    .maybeSingle();

  if (!statement || !scope.ownerIds.includes(statement.owner_id)) notFound();

  const totals = (statement.totals ?? {}) as Record<string, number | string>;
  const lines = (statement.lines ?? []) as {
    kind?: string;
    description?: string;
    amount_minor?: number;
    date?: string;
  }[];

  const rows: { label: string; value: number }[] = [
    { label: t("opening"), value: statement.opening_minor },
    { label: t("collections"), value: Number(totals.collections ?? 0) },
    { label: t("expenses"), value: Number(totals.expenses ?? 0) },
    { label: t("managementFee"), value: Number(totals.management_fee ?? 0) },
    { label: t("netPayable"), value: Number(totals.net_payable ?? statement.closing_minor) },
  ];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {statement.period_start} → {statement.period_end}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          <Badge variant={statement.status === "issued" ? "success" : "neutral"}>
            {statement.status}
          </Badge>
        </p>
        <OwnerStatementPdfButton statementId={id} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("totals")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-2 pt-0">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <span className="font-body-md text-body-md text-on-surface-variant">{r.label}</span>
              <span className="font-semibold text-on-surface">
                {formatMoney(BigInt(r.value), statement.currency, locale)}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {lines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t("lines")}</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("kind")}</th>
                    <th className="p-3 text-start">{t("description")}</th>
                    <th className="p-3 text-end">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {lines.map((l, i) => (
                    <tr key={`${l.kind}-${i}`}>
                      <td className="p-3 text-on-surface">{l.kind ?? "—"}</td>
                      <td className="p-3 text-on-surface-variant">{l.description ?? "—"}</td>
                      <td className="p-3 text-end text-on-surface">
                        {formatMoney(BigInt(l.amount_minor ?? 0), statement.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
