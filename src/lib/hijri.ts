/** Optional secondary Hijri display (SPEC D9). Gregorian remains the default everywhere. */
export function formatHijri(dateISO: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-US-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateISO}T00:00:00Z`));
}
