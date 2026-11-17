// src/server/actions/forecast.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const ForecastSchema = z.object({
  months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  scenario: z.enum(["base", "conservative", "optimistic"]),
  buildingIds: z.array(z.string()).optional(),
});

export type ForecastInput = z.infer<typeof ForecastSchema>;
export type ForecastResponse = {
  inflows: { month: number; charges: number; cheques: number }[];
  outflows: { month: number; expenses: number; payouts: number }[];
  net: { month: number; amount_minor: number }[];
  warnings: string[];
};

export async function getCashFlowForecast(input: unknown): Promise<ForecastResponse> {
  const parsed = ForecastSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid forecast input: ${parsed.error.message}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("forecast_cash_flow", {
    p_months: parsed.data.months,
    p_scenario: parsed.data.scenario,
    p_building_ids: parsed.data.buildingIds?.map((id) => id) || null,
  });

  if (error) {
    console.error("Forecast RPC failed:", error);
    throw new Error(`Failed to fetch cash flow forecast: ${error.message}`);
  }

  // Revalidate dashboard & reports pages on successful fetch
  revalidatePath("/[locale]/(app)/dashboard");
  revalidatePath("/[locale]/(app)/reports");

  return data as ForecastResponse;
}
