/**
 * Money is always integer minor units plus a currency code (SPEC D2).
 * Never use floats. KWD, BHD and OMR have 3 decimals.
 */
export const CURRENCY_EXPONENTS = {
  QAR: 2,
  AED: 2,
  SAR: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
} as const;

export type Currency = keyof typeof CURRENCY_EXPONENTS;

export function exponentOf(currency: string): number {
  const exponent = CURRENCY_EXPONENTS[currency as Currency];
  if (exponent === undefined) throw new Error(`Unsupported currency: ${currency}`);
  return exponent;
}

/**
 * Parse a user-entered decimal string ("1240.50") into minor units ("124050").
 * Rejects anything that is not a plain decimal, so no float ever touches money.
 */
export function toMinor(amount: string | number, currency: string): bigint {
  const exponent = exponentOf(currency);
  const text = typeof amount === "number" ? amount.toString() : amount.trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text.replace(/,/g, ""));
  if (!match) throw new Error(`Invalid amount: ${text}`);

  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > exponent) throw new Error(`Too many decimals for ${currency}: ${text}`);

  const minor = BigInt(whole! + fraction.padEnd(exponent, "0"));
  return sign ? -minor : minor;
}

export function toDecimal(minor: bigint, currency: string): string {
  const exponent = exponentOf(currency);
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(exponent + 1, "0");
  const whole = digits.slice(0, -exponent);
  const fraction = digits.slice(-exponent);
  return `${negative ? "-" : ""}${whole}${exponent ? `.${fraction}` : ""}`;
}

/** Grouped, locale-aware display value without the currency code. */
export function formatAmount(minor: bigint, currency: string, locale = "en"): string {
  const decimal = toDecimal(minor, currency);
  const [whole, fraction] = decimal.split(".");
  const grouped = new Intl.NumberFormat(locale === "ar" ? "ar-QA" : "en-QA", {
    maximumFractionDigits: 0,
  }).format(BigInt(whole!));
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatMoney(minor: bigint, currency: string, locale = "en"): string {
  return `${currency} ${formatAmount(minor, currency, locale)}`;
}

/** Split for the two-tone currency styling in DESIGN.md (code smaller and 80% opacity). */
export function splitMoney(minor: bigint, currency: string, locale = "en") {
  return { currency, amount: formatAmount(minor, currency, locale) };
}
