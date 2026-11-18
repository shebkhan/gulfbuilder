"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

interface CashFlowChartProps {
  data: Array<{ month: string; net: number }>;
  currency: string;
  locale: string;
  netLabel: string;
  monthLabel: string;
}

export default function CashFlowChart({
  data,
  currency,
  locale,
  netLabel,
  monthLabel,
}: CashFlowChartProps) {
  const money = (value: unknown) =>
    formatMoney(BigInt(Math.round(Number(value))), currency, locale);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" />
          <YAxis stroke="#6b7280" tickFormatter={money} />
          <Tooltip
            formatter={(value) => [money(value), netLabel]}
            labelFormatter={(label) => `${monthLabel}: ${label}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="net"
            stroke="#3b82f6"
            fill="url(#colorNet)"
            name={netLabel}
          />
          <defs>
            <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
