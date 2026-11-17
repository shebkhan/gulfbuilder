import { describe, expect, it } from "vitest";
import {
  chequePipeline,
  collections,
  daysInPeriod,
  gprAndVacancyLoss,
  leaseExpiries,
  occupancy,
  type ChargeForKpi,
  type ChequeForKpi,
  type LeaseForKpi,
  type UnitForKpi,
} from "@/lib/kpi";

const units: UnitForKpi[] = [
  { id: "u1", building_id: "b1", status: "occupied", default_rent_minor: 10_000 },
  { id: "u2", building_id: "b1", status: "vacant", default_rent_minor: 20_000 },
  { id: "u3", building_id: "b2", status: "reserved", default_rent_minor: null },
];

const leases: LeaseForKpi[] = [
  {
    id: "l1",
    unit_id: "u1",
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    rent_minor: 10_000,
  },
];

describe("occupancy", () => {
  it("counts every unit status", () => {
    const kpi = occupancy(units);
    expect(kpi).toMatchObject({ total: 3, occupied: 1, vacant: 1, reserved: 1 });
    expect(kpi.occupancyPct).toBe(33.3);
  });

  it("survives an empty portfolio", () => {
    expect(occupancy([]).occupancyPct).toBe(0);
  });
});

describe("gpr and vacancy loss", () => {
  it("counts a full month of rent and the vacant share", () => {
    const kpi = gprAndVacancyLoss(units, leases, "2026-11-01", "2026-11-30");
    // u1 is leased for the whole month, u2 is vacant for all of it.
    expect(kpi.gpr).toBe(30_000);
    expect(kpi.vacancyLoss).toBe(20_000);
    expect(kpi.egI).toBe(10_000);
  });

  it("counts the days around a lease as vacancy", () => {
    const kpi = gprAndVacancyLoss(units, leases, "2026-12-01", "2026-12-31");
    // 31 days at 20,000 a month: the vacant unit is 31/30 of a month.
    expect(kpi.vacancyLoss).toBe(20_667);
  });

  it("counts the days of a period", () => {
    expect(daysInPeriod("2026-11-01", "2026-11-30")).toBe(30);
    expect(daysInPeriod("2026-11-01", "2026-11-01")).toBe(1);
  });
});

describe("collections", () => {
  const charges: ChargeForKpi[] = [
    {
      id: "c1",
      lease_id: "l1",
      type: "rent",
      due_date: "2026-10-01",
      amount_minor: 10_000,
      paid_minor: 10_000,
      status: "paid",
    },
    {
      id: "c2",
      lease_id: "l1",
      type: "rent",
      due_date: "2026-10-01",
      amount_minor: 10_000,
      paid_minor: 0,
      status: "overdue",
    },
    {
      id: "c3",
      lease_id: "l1",
      type: "deposit",
      due_date: "2026-10-01",
      amount_minor: 20_000,
      paid_minor: 20_000,
      status: "paid",
    },
  ];

  it("counts rent only, not deposits", () => {
    const kpi = collections(charges, [], []);
    expect(kpi.billed).toBe(20_000);
    expect(kpi.collected).toBe(10_000);
    expect(kpi.outstanding).toBe(10_000);
    expect(kpi.rate).toBe(50);
  });

  it("averages the days a payment took to land", () => {
    const kpi = collections(
      charges,
      [{ id: "p1", received_at: "2026-10-11T00:00:00Z", amount_minor: 10_000 }],
      [{ payment_id: "p1", charge_id: "c1", amount_minor: 10_000 }],
    );
    expect(kpi.averageDaysToPay).toBe(10);
  });
});

describe("lease expiries", () => {
  const expiring: LeaseForKpi[] = [
    {
      id: "l1",
      unit_id: "u1",
      status: "active",
      start_date: "2026-01-01",
      end_date: "2026-11-20",
      rent_minor: 10_000,
    },
    {
      id: "l2",
      unit_id: "u2",
      status: "active",
      start_date: "2026-01-01",
      end_date: "2026-12-20",
      rent_minor: 10_000,
    },
    {
      id: "l3",
      unit_id: "u3",
      status: "renewed",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      rent_minor: 10_000,
    },
    {
      id: "l4",
      unit_id: "u3",
      status: "expired",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      rent_minor: 10_000,
    },
  ];

  it("buckets expiries by 30, 60 and 90 days", () => {
    const kpi = leaseExpiries(expiring, "2026-11-16");
    expect(kpi.d30.map((lease) => lease.id)).toEqual(["l1"]);
    expect(kpi.d60.map((lease) => lease.id)).toEqual(["l2"]);
    expect(kpi.d90).toHaveLength(0);
  });

  it("counts the renewal rate", () => {
    const kpi = leaseExpiries(expiring, "2026-11-16");
    expect(kpi.renewed).toBe(1);
    expect(kpi.expired).toBe(1);
    expect(kpi.renewalRate).toBe(50);
  });
});

describe("cheque pipeline", () => {
  const cheques: ChequeForKpi[] = [
    { id: "q1", status: "received", cheque_date: "2026-11-20", amount_minor: 5_000 },
    { id: "q2", status: "received", cheque_date: "2026-12-10", amount_minor: 7_000 },
    { id: "q3", status: "cleared", cheque_date: "2026-10-01", amount_minor: 3_000 },
    { id: "q4", status: "bounced", cheque_date: "2026-10-01", amount_minor: 9_000 },
  ];

  it("splits what is due soon from what is at risk", () => {
    const kpi = chequePipeline(cheques, "2026-11-16");
    expect(kpi.dueThisWeek).toEqual({ count: 1, amount: 5_000 });
    expect(kpi.dueThisMonth).toEqual({ count: 2, amount: 12_000 });
    expect(kpi.atRisk).toEqual({ count: 1, amount: 9_000 });
    expect(kpi.byStatus.cleared).toEqual({ count: 1, amount: 3_000 });
  });
});
