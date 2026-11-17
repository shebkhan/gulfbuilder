/**
 * Portfolio KPIs (SPEC §9). One place owns every number so the dashboard, the
 * reports and the owner statements cannot disagree.
 *
 * All amounts are minor units (QAR fils). Period lengths are counted in days and
 * rent is converted with a 30 day month, which is how the leases are billed.
 */

export type UnitForKpi = {
  id: string;
  building_id: string;
  status: string;
  default_rent_minor: number | null;
};

export type LeaseForKpi = {
  id: string;
  unit_id: string | null;
  status: string;
  start_date: string;
  end_date: string;
  rent_minor: number;
};

export type ChargeForKpi = {
  id: string;
  lease_id: string;
  type: string;
  due_date: string;
  amount_minor: number;
  paid_minor: number;
  status: string;
};

export type PaymentForKpi = {
  id: string;
  received_at: string;
  amount_minor: number;
};

export type AllocationForKpi = {
  payment_id: string;
  charge_id: string;
  amount_minor: number;
};

export type ChequeForKpi = {
  id: string;
  status: string;
  cheque_date: string;
  amount_minor: number;
};

const DAYS_PER_MONTH = 30;

function toDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

export function daysInPeriod(from: string, to: string): number {
  const days = Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}

/** How many days of the period a lease covers. */
export function coveredDays(lease: LeaseForKpi, from: string, to: string): number {
  const start = lease.start_date > from ? lease.start_date : from;
  const end = lease.end_date < to ? lease.end_date : to;
  if (end < start) return 0;
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000) + 1;
}

export type OccupancyKpi = {
  total: number;
  occupied: number;
  vacant: number;
  reserved: number;
  maintenance: number;
  occupancyPct: number;
};

export function occupancy(units: UnitForKpi[]): OccupancyKpi {
  const counts = { occupied: 0, vacant: 0, reserved: 0, maintenance: 0 };
  for (const unit of units) {
    if (unit.status === "occupied") counts.occupied += 1;
    else if (unit.status === "reserved") counts.reserved += 1;
    else if (unit.status === "maintenance") counts.maintenance += 1;
    else counts.vacant += 1;
  }
  const total = units.length;
  return {
    total,
    ...counts,
    occupancyPct: total ? Math.round((counts.occupied / total) * 1000) / 10 : 0,
  };
}

export type ValueKpi = {
  /** Gross potential rent for the period at lease or default rate. */
  gpr: number;
  /** Rent lost to vacancy over the period. */
  vacancyLoss: number;
  /** Effective gross income: GPR less vacancy loss. */
  egI: number;
};

/**
 * GPR and vacancy loss for a period. A unit without a lease over the period is
 * vacant for all of it; a unit with one is vacant for the days around it.
 */
export function gprAndVacancyLoss(
  units: UnitForKpi[],
  leases: LeaseForKpi[],
  from: string,
  to: string,
): ValueKpi {
  const days = daysInPeriod(from, to);
  let gpr = 0;
  let vacancyLoss = 0;

  for (const unit of units) {
    const unitLeases = leases.filter((lease) => lease.unit_id === unit.id);
    const overlapping = unitLeases.filter(
      (lease) => lease.start_date <= to && lease.end_date >= from,
    );
    const active =
      overlapping.find((lease) => lease.status === "active") ?? overlapping[0] ?? undefined;
    const rate = active?.rent_minor ?? unit.default_rent_minor ?? 0;
    if (rate === 0) continue;

    gpr += Math.round((rate * days) / DAYS_PER_MONTH);
    const covered = active ? coveredDays(active, from, to) : 0;
    const vacantDays = Math.max(0, days - covered);
    vacancyLoss += Math.round((rate * vacantDays) / DAYS_PER_MONTH);
  }

  return { gpr, vacancyLoss, egI: gpr - vacancyLoss };
}

export type CollectionKpi = {
  billed: number;
  collected: number;
  outstanding: number;
  /** Collected as a share of billed, in percent. */
  rate: number;
  /** Average days between a charge falling due and its payment landing. */
  averageDaysToPay: number | null;
};

/**
 * Collection performance for a period. `allocations` link payments to the charges
 * they settle, which is what makes the days-to-pay figure meaningful.
 */
export function collections(
  charges: ChargeForKpi[],
  payments: PaymentForKpi[],
  allocations: AllocationForKpi[],
): CollectionKpi {
  const rentCharges = charges.filter((charge) => charge.type === "rent");
  const billed = rentCharges.reduce((sum, charge) => sum + charge.amount_minor, 0);
  const collected = rentCharges.reduce((sum, charge) => sum + charge.paid_minor, 0);
  const outstanding = billed - collected;

  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const chargeById = new Map(charges.map((charge) => [charge.id, charge]));
  const delays: number[] = [];
  for (const allocation of allocations) {
    const payment = paymentById.get(allocation.payment_id);
    const charge = chargeById.get(allocation.charge_id);
    if (!payment || !charge) continue;
    const delay = Math.round(
      (toDate(payment.received_at).getTime() - toDate(charge.due_date).getTime()) / 86_400_000,
    );
    delays.push(delay);
  }
  const averageDaysToPay = delays.length
    ? Math.round(delays.reduce((sum, delay) => sum + delay, 0) / delays.length)
    : null;

  return {
    billed,
    collected,
    outstanding,
    rate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
    averageDaysToPay,
  };
}

export type ExpiryBucket = {
  /** Leases ending within 30 days. */
  d30: LeaseForKpi[];
  /** Leases ending between 31 and 60 days. */
  d60: LeaseForKpi[];
  /** Leases ending between 61 and 90 days. */
  d90: LeaseForKpi[];
  /** Renewed against expired leases: the rate is the share that renewed. */
  renewed: number;
  expired: number;
  renewalRate: number;
};

/** Expiries in the next 90 days and the renewal rate for the period. */
export function leaseExpiries(leases: LeaseForKpi[], from: string): ExpiryBucket {
  const horizon = toDate(from);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const buckets: ExpiryBucket = {
    d30: [],
    d60: [],
    d90: [],
    renewed: 0,
    expired: 0,
    renewalRate: 0,
  };

  for (const lease of leases) {
    if (lease.status === "renewed") buckets.renewed += 1;
    if (lease.status === "expired" || lease.status === "terminated") buckets.expired += 1;
    if (lease.status !== "active" && lease.status !== "draft") continue;
    if (lease.end_date < from || lease.end_date > horizonDate) continue;

    const days = Math.round(
      (toDate(lease.end_date).getTime() - toDate(from).getTime()) / 86_400_000,
    );
    if (days <= 30) buckets.d30.push(lease);
    else if (days <= 60) buckets.d60.push(lease);
    else buckets.d90.push(lease);
  }

  const decided = buckets.renewed + buckets.expired;
  buckets.renewalRate = decided ? Math.round((buckets.renewed / decided) * 1000) / 10 : 0;

  return buckets;
}

export type ChequeKpi = {
  byStatus: Record<string, { count: number; amount: number }>;
  dueThisWeek: { count: number; amount: number };
  dueThisMonth: { count: number; amount: number };
  /** Bounced cheques that were not replaced: the money we are waiting on. */
  atRisk: { count: number; amount: number };
};

/** Cheque pipeline: what is out, what is due, and what is at risk. */
export function chequePipeline(cheques: ChequeForKpi[], today: string): ChequeKpi {
  const week = toDate(today);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekDate = week.toISOString().slice(0, 10);
  const month = toDate(today);
  month.setUTCDate(month.getUTCDate() + 30);
  const monthDate = month.toISOString().slice(0, 10);

  const empty = { count: 0, amount: 0 };
  const kpi: ChequeKpi = {
    byStatus: {},
    dueThisWeek: { ...empty },
    dueThisMonth: { ...empty },
    atRisk: { ...empty },
  };

  for (const cheque of cheques) {
    const entry = (kpi.byStatus[cheque.status] ??= { count: 0, amount: 0 });
    entry.count += 1;
    entry.amount += cheque.amount_minor;

    if (cheque.status === "bounced" || cheque.status === "returned") {
      kpi.atRisk.count += 1;
      kpi.atRisk.amount += cheque.amount_minor;
      continue;
    }
    if (cheque.status !== "received") continue;
    if (cheque.cheque_date >= today && cheque.cheque_date <= weekDate) {
      kpi.dueThisWeek.count += 1;
      kpi.dueThisWeek.amount += cheque.amount_minor;
    }
    if (cheque.cheque_date >= today && cheque.cheque_date <= monthDate) {
      kpi.dueThisMonth.count += 1;
      kpi.dueThisMonth.amount += cheque.amount_minor;
    }
  }

  return kpi;
}
