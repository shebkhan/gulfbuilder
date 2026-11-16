import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export type ChargeRow = {
  id: string;
  type: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string;
  amount_minor: number;
  paid_minor: number;
  currency: string;
  status: string;
};

type Props = {
  charges: ChargeRow[];
  labels: {
    type: string;
    period: string;
    dueDate: string;
    amount: string;
    paid: string;
    status: string;
    noCharges: string;
    chargeTypes: Record<string, string>;
    chargeStatuses: Record<string, string>;
  };
};

export function LeaseSchedule({ charges, labels }: Props) {
  if (charges.length === 0) {
    return (
      <div className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
        {labels.noCharges}
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "success";
      case "partial":
        return "warning";
      case "overdue":
        return "danger";
      case "void":
        return "neutral";
      default:
        return "info";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start font-body-sm text-body-sm">
        <thead>
          <tr className="border-b border-hairline text-on-surface-variant">
            <th className="py-2.5 pe-4 text-start font-medium">{labels.type}</th>
            <th className="py-2.5 pe-4 text-start font-medium">{labels.period}</th>
            <th className="py-2.5 pe-4 text-start font-medium">{labels.dueDate}</th>
            <th className="py-2.5 pe-4 text-end font-medium">{labels.amount}</th>
            <th className="py-2.5 pe-4 text-end font-medium">{labels.paid}</th>
            <th className="py-2.5 text-center font-medium">{labels.status}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {charges.map((charge) => (
            <tr key={charge.id} className="hover:bg-surface-container-low/40">
              <td className="py-3 pe-4 font-medium text-on-surface">
                {labels.chargeTypes[charge.type] ?? charge.type}
              </td>
              <td className="py-3 pe-4 text-on-surface-variant">
                {charge.period_start && charge.period_end
                  ? `${charge.period_start} → ${charge.period_end}`
                  : "—"}
              </td>
              <td className="py-3 pe-4 text-on-surface-variant" dir="ltr">
                {charge.due_date}
              </td>
              <td className="py-3 pe-4 text-end font-medium text-on-surface">
                {formatMoney(BigInt(charge.amount_minor), charge.currency)}
              </td>
              <td className="py-3 pe-4 text-end text-on-surface-variant">
                {formatMoney(BigInt(charge.paid_minor), charge.currency)}
              </td>
              <td className="py-3 text-center">
                <Badge variant={getStatusVariant(charge.status)}>
                  {labels.chargeStatuses[charge.status] ?? charge.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

