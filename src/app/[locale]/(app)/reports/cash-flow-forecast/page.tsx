// src/app/[locale]/(app)/reports/cash-flow-forecast/route.tsx
"use client";

import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { getCashFlowForecast, ForecastInput, ForecastResponse } from "@/server/actions/forecast";

export default function CashFlowForecastPage() {
  const t = useTranslations("Reports.CashFlowForecast");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<3 | 6 | 12>(3);
  const [scenario, setScenario] = useState<"base" | "conservative" | "optimistic">("base");
  const [renewalRate, setRenewalRate] = useState<number>(75);
  const [chequeClearance, setChequeClearance] = useState<number>(85);

  // Load initial forecast
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const input: ForecastInput = { months, scenario };
        const result = await getCashFlowForecast(input);
        setForecast(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load forecast");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [months, scenario]);

  // Mock "what-if" effect (in real app, this would call a separate RPC)
  const handleWhatIf = () => {
    alert(
      `What-if applied:\n- Renewal rate: ${renewalRate}%\n- Cheque clearance: ${chequeClearance}%\n\n(Real implementation would call a refined RPC)`,
    );
  };

  // Format chart data
  const chartData =
    forecast?.net.map((item) => ({
      month: `Month ${item.month}`,
      net: Number(item.amount_minor),
    })) || [];

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error)
    return (
      <div className="p-6 text-red-600">
        {t("error")}: {error}
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("description")}</p>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t("controls.title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("controls.description")}</p>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <Label htmlFor="months">{t("controls.months")}</Label>
              <Select
                value={String(months)}
                onValueChange={(value) => setMonths(Number(value) as 3 | 6 | 12)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 {t("months")}</SelectItem>
                  <SelectItem value="6">6 {t("months")}</SelectItem>
                  <SelectItem value="12">12 {t("months")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("controls.scenario")}</Label>
              <RadioGroup
                value={scenario}
                onValueChange={(value) =>
                  setScenario(value as "base" | "conservative" | "optimistic")
                }
                className="mt-2 flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="base" id="base" />
                  <Label
                    htmlFor="base"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t("scenarios.base")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="conservative" id="conservative" />
                  <Label
                    htmlFor="conservative"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t("scenarios.conservative")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="optimistic" id="optimistic" />
                  <Label
                    htmlFor="optimistic"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t("scenarios.optimistic")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>{t("controls.whatIf")}</Label>
              <Button onClick={handleWhatIf} className="mt-2 w-full" variant="secondary">
                {t("controls.applyWhatIf")}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-3 font-medium">{t("whatIf.title")}</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between">
                  <span>
                    {t("whatIf.renewalRate")} ({renewalRate}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={renewalRate}
                  onChange={(e) => setRenewalRate(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span>
                    {t("whatIf.chequeClearance")} ({chequeClearance}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={chequeClearance}
                  onChange={(e) => setChequeClearance(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Warnings */}
      {forecast?.warnings.length ? (
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-yellow-800">
              ⚠️ {t("warnings.title")}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-yellow-700">
              {forecast.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t("chart.title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("chart.description")}</p>
        </CardHeader>
        <CardBody>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis
                  stroke="#6b7280"
                  tickFormatter={(value) => `${t("currency.QAR")} ${Number(value) / 100}`}
                />
                <Tooltip
                  formatter={(value) => [
                    `${t("currency.QAR")} ${Number(value) / 100}`,
                    t("chart.net"),
                  ]}
                  labelFormatter={(label) => `${t("chart.month")}: ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#3b82f6"
                  fill="url(#colorNet)"
                  name={t("chart.net")}
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
        </CardBody>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("summary.title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("summary.description")}</p>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 ps-2 text-left">{t("summary.month")}</th>
                  <th className="py-2 pe-2 text-right">{t("summary.inflow")}</th>
                  <th className="py-2 pe-2 text-right">{t("summary.outflow")}</th>
                  <th className="py-2 pe-2 text-right">{t("summary.net")}</th>
                </tr>
              </thead>
              <tbody>
                {forecast?.net.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/50 border-b last:border-0">
                    <td className="py-2 ps-2">{t("summary.monthLabel", { month: item.month })}</td>
                    <td className="py-2 pe-2 text-right">
                      {formatMoney(
                        BigInt(
                          Math.round(
                            (forecast.inflows[i]?.charges ?? 0) + (forecast.inflows[i]?.cheques ?? 0),
                          ),
                        ),
                        "QAR",
                      )}
                    </td>
                    <td className="py-2 pe-2 text-right">
                      {formatMoney(
                        BigInt(
                          Math.round(
                            (forecast.outflows[i]?.expenses ?? 0) +
                              (forecast.outflows[i]?.payouts ?? 0),
                          ),
                        ),
                        "QAR",
                      )}
                    </td>
                    <td className="py-2 pe-2 text-right font-medium">
                      {formatMoney(BigInt(Math.round(item.amount_minor)), "QAR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
