import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import type { AgedReceivableItem } from "@/server/actions/reports";

type AgedReceivablesTableProps = {
  agedReceivables: AgedReceivableItem[];
  locale: string;
  labels: {
    emptyReceivables: string;
    tenant: string;
    lease: string;
    overdueDays: string;
    bucket: string;
    amount: string;
  };
};

export function AgedReceivablesTable({
  agedReceivables,
  locale,
  labels,
}: AgedReceivablesTableProps) {
  const getAgingBadgeVariant = (bucket: string) => {
    switch (bucket) {
      case "90_plus":
        return "danger";
      case "61_90":
        return "danger";
      case "31_60":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
      {agedReceivables.length === 0 ? (
        <div className="p-12 text-center text-on-surface-variant">{labels.emptyReceivables}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <th className="p-4 text-start">{labels.tenant}</th>
                <th className="p-4 text-start">{labels.lease}</th>
                <th className="p-4 text-start">{labels.overdueDays}</th>
                <th className="p-4 text-start">{labels.bucket}</th>
                <th className="p-4 text-end">{labels.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {agedReceivables.map((a, idx) => (
                <tr key={idx} className="transition-colors hover:bg-surface-container-low/50">
                  <td className="p-4 font-medium text-on-surface">{a.tenant_name}</td>
                  <td className="p-4 font-mono text-primary">{a.lease_no}</td>
                  <td className="p-4 text-on-surface-variant">{a.days_overdue} days</td>
                  <td className="p-4">
                    <Badge variant={getAgingBadgeVariant(a.bucket)}>
                      {a.bucket.replace("_", "-")} days
                    </Badge>
                  </td>
                  <td className="p-4 text-end font-semibold text-error">
                    {formatMoney(BigInt(a.amount_minor), a.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
