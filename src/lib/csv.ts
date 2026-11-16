/**
 * Minimal RFC 4180 CSV reader for the import template: quotes, escaped quotes,
 * embedded commas/newlines, CRLF and a leading BOM. Headers are lowercased.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];

  const keys = header.map((key) => key.trim().toLowerCase());
  return body
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? "").trim()])));
}
