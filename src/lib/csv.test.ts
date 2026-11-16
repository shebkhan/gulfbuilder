import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("maps headers to lowercase keys and trims cells", () => {
    const rows = parseCsv("Type , Code\n building , B1 \n");
    expect(rows).toEqual([{ type: "building", code: "B1" }]);
  });

  it("keeps quoted commas, escaped quotes and newlines", () => {
    const rows = parseCsv('a,b\n"Tower, West","say ""hi""\nagain"\n');
    expect(rows).toEqual([{ a: "Tower, West", b: 'say "hi"\nagain' }]);
  });

  it("handles CRLF, a BOM and trailing blank lines", () => {
    const rows = parseCsv("\uFEFFa,b\r\n1,2\r\n\r\n");
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("fills missing cells with empty strings", () => {
    const rows = parseCsv("a,b,c\n1\n");
    expect(rows).toEqual([{ a: "1", b: "", c: "" }]);
  });
});
