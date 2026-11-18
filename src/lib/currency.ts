import { CURRENCY_EXPONENTS, type Currency } from "@/lib/money";

export const DEFAULT_CURRENCY = "QAR";

/** Org currency, or the Qatar default when unset/unsupported (SPEC D2/D3). */
export function resolveCurrency(currency: string | null | undefined): string {
  return currency && CURRENCY_EXPONENTS[currency as Currency] !== undefined
    ? currency
    : DEFAULT_CURRENCY;
}
