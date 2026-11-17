import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export type RawStatementItem = {
  id: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
  closing_minor: number;
  totals: unknown;
  owners: { id: string; name: string } | null;
};

type StatementsTableProps = {
  statements: RawStatementItem[];
  locale: string;
  labels: {
    emptyStatements: string;
    owner: string;
    period: string;
    status: string;
    collections: string;
    expenses: string;
    managementFee: string;
    netPayable: string;
    issued: string;
  };
};

export function StatementsTable({ statements, locale, labels }: StatementsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
      {!statements || statements.length === 0 ? (
        <div className="p-12 text-center text-on-surface-variant">{labels.emptyStatements}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <th className="p-4 text-start">{labels.owner}</th>
                <th className="p-4 text-start">{labels.period}</th>
                <th className="p-4 text-start">{labels.status}</th>
                <th className="p-4 text-end">{labels.collections}</th>
                <th className="p-4 text-end">{labels.expenses}</th>
                <th className="p-4 text-end">{labels.managementFee}</th>
                <th className="p-4 text-end">{labels.netPayable}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {statements.map((s) => {
                const owner = s.owners;
                const totals = (s.totals || {}) as {
                  collections?: number;
                  expenses?: number;
                  management_fee?: number;
                  net_payable?: number;
                };

                return (
                  <tr
                    key={s.id}
                    className="transition-colors hover:bg-surface-container-low/50"
                  >
                    <td className="p-4 font-semibold text-on-surface">{owner?.name || "—"}</td>
                    <td className="p-4 text-on-surface-variant">
                      {s.period_start} to {s.period_end}
                    </td>
                    <td className="p-4">
                      <Badge variant={s.status === "issued" ? "success" : "neutral"}>
                        {s.status === "issued" ? labels.issued : s.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-end text-on-surface">
                      {formatMoney(BigInt(totals.collections ?? 0), s.currency, locale)}
                    </td>
                    <td className="p-4 text-end text-error">
                      {formatMoney(BigInt(totals.expenses ?? 0), s.currency, locale)}
                    </td>
                    <td className="p-4 text-end text-on-surface-variant">
                      {formatMoney(BigInt(totals.management_fee ?? 0), s.currency, locale)}
                    </td>
                    <td className="p-4 text-end font-bold text-primary">
                      {formatMoney(BigInt(s.closing_minor), s.currency, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
