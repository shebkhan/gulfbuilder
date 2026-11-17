import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import type { RentRollItem } from "@/server/actions/reports";

type RentRollTableProps = {
  rentRoll: RentRollItem[];
  locale: string;
  labels: {
    emptyRentRoll: string;
    property: string;
    unit: string;
    tenant: string;
    lease: string;
    dates: string;
    status: string;
    rent: string;
  };
};

export function RentRollTable({ rentRoll, locale, labels }: RentRollTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
      {rentRoll.length === 0 ? (
        <div className="p-12 text-center text-on-surface-variant">{labels.emptyRentRoll}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <th className="p-4 text-start">{labels.property}</th>
                <th className="p-4 text-start">{labels.unit}</th>
                <th className="p-4 text-start">{labels.tenant}</th>
                <th className="p-4 text-start">{labels.lease}</th>
                <th className="p-4 text-start">{labels.dates}</th>
                <th className="p-4 text-start">{labels.status}</th>
                <th className="p-4 text-end">{labels.rent}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rentRoll.map((r, idx) => (
                <tr key={idx} className="transition-colors hover:bg-surface-container-low/50">
                  <td className="p-4 font-medium text-on-surface">
                    {r.building_code} - {r.building_name}
                  </td>
                  <td className="p-4 text-on-surface">{r.unit_no}</td>
                  <td className="p-4 text-on-surface">{r.tenant_name}</td>
                  <td className="p-4 font-mono text-primary">{r.lease_no}</td>
                  <td className="p-4 text-on-surface-variant">
                    {r.start_date} to {r.end_date}
                  </td>
                  <td className="p-4">
                    <Badge variant={r.status === "active" ? "success" : "neutral"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-end font-semibold text-on-surface">
                    {formatMoney(BigInt(r.rent_minor), r.currency, locale)}
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
