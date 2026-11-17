import { describe, expect, it } from "vitest";
import { relatedHrefs } from "./related-links";

describe("relatedHrefs", () => {
  it("keeps links the role can access", () => {
    const hrefs = relatedHrefs("leases", "manager");
    expect(hrefs).toContain("/tenants");
    expect(hrefs).toContain("/payments");
  });

  it("drops links the role cannot access", () => {
    expect(relatedHrefs("leases", "caretaker")).not.toContain("/payments");
  });
});
