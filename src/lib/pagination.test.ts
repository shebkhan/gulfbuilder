import { describe, expect, it } from "vitest";
import { paginate, pageHref, toPaginated } from "@/lib/pagination";

describe("pagination", () => {
  it("slices the requested page", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    const page = paginate(rows, 2, 10);
    expect(page.rows).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(page.pages).toBe(3);
    expect(page.total).toBe(25);
  });

  it("clamps page numbers into range", () => {
    const rows = [1, 2, 3];
    expect(paginate(rows, 0).page).toBe(1);
    expect(paginate(rows, 99).page).toBe(1);
    expect(paginate(rows, 99).rows).toEqual([1, 2, 3]);
    expect(paginate(rows, Number.NaN).page).toBe(1);
  });

  it("always reports at least one page", () => {
    expect(paginate([], 1).pages).toBe(1);
    expect(paginate([], 1).rows).toEqual([]);
  });

  it("keeps filters in the page links", () => {
    expect(pageHref("/tenants", { q: "ali" }, 3)).toBe("/tenants?q=ali&page=3");
    expect(pageHref("/tenants", {}, 1)).toBe("/tenants");
    expect(pageHref("/tenants", { q: undefined }, 2)).toBe("/tenants?page=2");
  });

  it("builds page metadata from a DB count", () => {
    expect(toPaginated([1, 2], 25, 2, 10)).toEqual({
      rows: [1, 2],
      page: 2,
      pages: 3,
      total: 25,
    });
    expect(toPaginated(null, 0, 9)).toEqual({ rows: [], page: 1, pages: 1, total: 0 });
    expect(toPaginated([1], null, 1)).toEqual({ rows: [1], page: 1, pages: 1, total: 1 });
  });
});
