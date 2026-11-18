/** Only the boolean is needed by the UI; never send the token itself to a client component. */
export function hasStoredToken(config: unknown): boolean {
  if (typeof config !== "object" || config === null) return false;
  const token = (config as Record<string, unknown>).bot_token;
  return typeof token === "string" && token.length > 0;
}
