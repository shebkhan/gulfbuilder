import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApprovalDecisionButtons } from "@/components/domain/approval-decision-buttons";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { getOwnerApprovals, getOwnerScope } from "@/server/queries/owner-portal";

type SearchParams = Promise<{ page?: string }>;

export default async function OwnerApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("owner.approvals");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const approvals = await getOwnerApprovals(scope);
  const paged = paginate(approvals, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {approvals.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {paged.rows.map((a) => {
                const expense = a.expenses as unknown as {
                  id: string;
                  category: string;
                  description: string;
                  amount_minor: number;
                  currency: string;
                  status: string;
                  expense_date: string;
                  buildings: { code: string } | null;
                } | null;
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md font-medium text-on-surface">
                          {expense?.description ?? t("expense")}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {expense?.category ?? "—"} · {expense?.buildings?.code ?? "—"} ·{" "}
                          {expense?.expense_date ?? ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-on-surface">
                          {expense
                            ? formatMoney(BigInt(expense.amount_minor), expense.currency, locale)
                            : "—"}
                        </span>
                        <Badge
                          variant={
                            a.status === "approved"
                              ? "success"
                              : a.status === "rejected"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {a.status}
                        </Badge>
                      </div>
                    </div>
                    {a.status === "pending" && <ApprovalDecisionButtons approvalId={a.id} />}
                  </li>
                );
              })}
            </ul>
          )}

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/owner/approvals"
          />
        </CardBody>
      </Card>
    </div>
  );
}
