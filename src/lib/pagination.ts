export const PAGE_SIZE = 20;

export type Paginated<T> = {
  rows: T[];
  page: number;
  pages: number;
  total: number;
};

/**
 * Returns zero-indexed [from, to] range boundaries for SQL / Supabase `.range(from, to)`.
 */
export function getPaginationRange(page: number, pageSize = PAGE_SIZE): { from: number; to: number } {
  const current = Math.max(1, Math.trunc(page) || 1);
  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

/** Slices a list for the requested page. Page numbers are clamped to the list. */
export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE): Paginated<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return {
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pages,
    total,
  };
}

/** Builds a list link that keeps the active filters and moves to another page. */
export function pageHref(
  base: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
