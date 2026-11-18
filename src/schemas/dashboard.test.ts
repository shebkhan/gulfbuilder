import { describe, expect, it } from "vitest";
import { dashboardSchema } from "./dashboard";

const payload = {
  kpis: {
    total_units: 10,
    occupied_units: 7,
    vacant_units: 3,
    occupancy_pct: 70,
    monthly_rent_roll: 1250000,
    ytd_collections: 9000000,
    ytd_expenses: 2000000,
    net_operating_income: 7000000,
    overdue_receivables: 150000,
  },
  expiringLeases: [
    {
      lease_id: "6f0b8f52-1c33-4d40-9c40-0f2a1f6a2a11",
      lease_no: "L-2026-001",
      tenant_name: "Sara",
      end_date: "2026-12-01",
      days_left: 13,
    },
  ],
  openMaintenance: 2,
  upcomingCheques: [
    {
      id: "a1",
      cheque_no: "000123",
      bank_name: null,
      amount_minor: 450000,
      currency: "QAR",
      cheque_date: "2026-11-25",
      status: "deposited",
      tenant_name: "Sara",
    },
  ],
  recentPayments: [
    {
      id: "p1",
      receipt_no: 7,
      receipt_year: 2026,
      amount_minor: 300000,
      currency: "QAR",
      method: "cash",
      received_at: "2026-11-18T08:00:00Z",
      tenant_name: null,
    },
  ],
  recentMaintenance: [
    {
      id: "m1",
      title: "Leak",
      priority: "high",
      status: "open",
      opened_at: "2026-11-17T08:00:00Z",
      building_code: "B1",
      unit_no: null,
    },
  ],
  buildings: [{ id: "b1", code: "B1", name: "Marina", units: [{ id: "u1", status: "occupied" }] }],
};

describe("dashboardSchema", () => {
  it("accepts the shape the service returns", () => {
    expect(dashboardSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts an empty portfolio with no KPI row", () => {
    const empty = {
      ...payload,
      kpis: null,
      expiringLeases: [],
      upcomingCheques: [],
      recentPayments: [],
      recentMaintenance: [],
      buildings: [],
    };
    expect(dashboardSchema.safeParse(empty).success).toBe(true);
  });

  it("accepts payments without a receipt number", () => {
    const unnumbered = {
      ...payload,
      recentPayments: [
        { ...payload.recentPayments[0], receipt_no: null, receipt_year: null },
      ],
    };
    expect(dashboardSchema.safeParse(unnumbered).success).toBe(true);
  });

  it("rejects money sent as a string", () => {
    const bad = {
      ...payload,
      upcomingCheques: [{ ...payload.upcomingCheques[0], amount_minor: "450000" }],
    };
    expect(dashboardSchema.safeParse(bad).success).toBe(false);
  });
});
