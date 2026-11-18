import { can } from "@/lib/rbac";
import { parseForecastInput } from "@/schemas/forecast";
import { getOrgContext } from "@/server/org-context";

export type ForecastResponse = {
  inflows: { month: number; charges: number; cheques: number }[];
  outflows: { month: number; expenses: number; payouts: number }[];
  net: { month: number; amount_minor: number }[];
  warnings: string[];
};

/** Read model for the forecast page: authenticated, org-scoped and capability-checked. */
export async function getForecast(input: unknown): Promise<ForecastResponse> {
  const parsed = parseForecastInput(input);
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "reports.read")) throw new Error("Forbidden");

  const { data, error } = await ctx.supabase.rpc("forecast_cash_flow", {
    p_months: parsed.months,
    p_scenario: parsed.scenario,
    p_building_ids: null,
  });
  if (error) {
    console.error("Forecast RPC failed", error);
    throw new Error("Could not load the forecast");
  }
  return data as ForecastResponse;
}
