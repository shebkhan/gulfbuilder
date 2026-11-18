import { z } from "zod";

const ForecastInputSchema = z.object({
  months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  scenario: z.enum(["base", "conservative", "optimistic"]),
});

export type ForecastInput = z.infer<typeof ForecastInputSchema>;

export function parseForecastInput(input: unknown): ForecastInput {
  return ForecastInputSchema.parse(input);
}
