/** Show only the last 4 characters, for tables and logs (never log the raw value). */
export function maskId(value: string): string {
  return value.length > 4 ? `••••${value.slice(-4)}` : "••••";
}
