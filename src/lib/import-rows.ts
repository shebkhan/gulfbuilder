import { toMinor } from "@/lib/money";

export type ImportRow = Record<string, string>;
export type ImportRowError = { row: string; message: string };

export const IMPORT_HEADERS = [
  "type",
  "code",
  "name",
  "owner",
  "city",
  "country_code",
  "floor",
  "unit_no",
  "unit_type",
  "area_sqm",
  "rent",
] as const;

/**
 * Maps parsed CSV records onto the row shape `import_property_rows` expects.
 * `code` means the building code on both row kinds. Rent arrives in major units
 * and is converted to minor units here so the database never sees a float.
 */
export function toImportRows(
  csv: Record<string, string>[],
  currency: string,
): { rows: ImportRow[]; errors: ImportRowError[] } {
  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  csv.forEach((record, index) => {
    const row = String(index + 2);
    const kind = (record.type ?? "").toLowerCase();

    if (kind === "building") {
      rows.push({
        row,
        kind,
        code: record.code ?? "",
        name: record.name ?? "",
        owner: record.owner ?? "",
        city: record.city ?? "",
        country_code: record.country_code ?? "",
      });
      return;
    }

    if (kind === "unit") {
      let rentMinor = "";
      if (record.rent) {
        try {
          rentMinor = toMinor(record.rent, currency).toString();
        } catch {
          errors.push({ row, message: `invalid rent: ${record.rent}` });
          return;
        }
      }
      rows.push({
        row,
        kind,
        building: record.code ?? "",
        floor: record.floor || "0",
        unit_no: record.unit_no ?? "",
        unit_type: record.unit_type ?? "",
        area_sqm: record.area_sqm ?? "",
        rent_minor: rentMinor,
      });
      return;
    }

    errors.push({ row, message: `unknown type: ${record.type || "(blank)"}` });
  });

  return { rows, errors };
}
