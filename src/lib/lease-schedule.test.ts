import { describe, expect, it } from "vitest";
import { planLeaseCharges } from "./lease-schedule";

const base = {
  currency: "QAR",
  frequency: "annual" as const,
  startDate: "2027-01-01",
  endDate: "2028-01-01",
  dueDay: 1,
  depositMinor: 0n,
};

describe("planLeaseCharges", () => {
  it("splits one annual rent into four equal installments", () => {
    const rows = planLeaseCharges({ ...base, rentMinor: 1_200_000n, installments: 4 });
    expect(rows.map((row) => row.amountMinor)).toEqual([300_000n, 300_000n, 300_000n, 300_000n]);
    expect(rows.map((row) => row.periodStart)).toEqual([
      "2027-01-01",
      "2027-04-01",
      "2027-07-01",
      "2027-10-01",
    ]);
  });

  it("puts the rounding remainder on the last charge", () => {
    const rows = planLeaseCharges({ ...base, rentMinor: 1_000n, installments: 3 });
    expect(rows.map((row) => row.amountMinor)).toEqual([333n, 333n, 334n]);
  });

  it("generates one charge per month for a monthly lease", () => {
    const rows = planLeaseCharges({
      ...base,
      frequency: "monthly",
      startDate: "2027-01-01",
      endDate: "2027-04-01",
      rentMinor: 500_000n,
      installments: 1,
    });
    expect(rows.map((row) => row.periodStart)).toEqual(["2027-01-01", "2027-02-01", "2027-03-01"]);
    expect(rows.map((row) => row.amountMinor)).toEqual([500_000n, 500_000n, 500_000n]);
  });

  it("puts everything on the last charge when installments exceed the minor units", () => {
    const rows = planLeaseCharges({ ...base, rentMinor: 2n, installments: 3 });
    expect(rows.map((row) => row.amountMinor)).toEqual([0n, 0n, 2n]);
  });

  it("adds a deposit charge only when a deposit is set", () => {
    const withDeposit = planLeaseCharges({ ...base, rentMinor: 1_200_000n, installments: 4, depositMinor: 200_000n });
    expect(withDeposit.filter((row) => row.type === "deposit")).toEqual([
      { type: "deposit", periodStart: "2027-01-01", periodEnd: "2027-01-01", dueDate: "2027-01-01", amountMinor: 200_000n },
    ]);
    const without = planLeaseCharges({ ...base, rentMinor: 1_200_000n, installments: 4 });
    expect(without.some((row) => row.type === "deposit")).toBe(false);
  });

  it("clamps a due day past the end of the month", () => {
    const rows = planLeaseCharges({
      ...base,
      frequency: "monthly",
      dueDay: 31,
      rentMinor: 100_000n,
      installments: 1,
      startDate: "2027-01-01",
      endDate: "2027-03-01",
    });
    expect(rows.map((row) => row.dueDate)).toEqual(["2027-01-31", "2027-02-28"]);
  });

  it("rejects a term shorter than one installment period", () => {
    expect(() =>
      planLeaseCharges({ ...base, startDate: "2027-01-01", endDate: "2027-01-15", rentMinor: 1n, installments: 1 }),
    ).toThrow(/shorter/i);
  });

  it("rejects unsupported custom schedules", () => {
    expect(() =>
      planLeaseCharges({ ...base, frequency: "custom" as never, rentMinor: 1n, installments: 1 }),
    ).toThrow(/custom/i);
  });
});
