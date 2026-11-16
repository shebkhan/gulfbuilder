import { addMonthsISO, FREQUENCY_MONTHS, isValidISODate, type PaymentFrequency } from "./dates";

export type PlannedCharge = {
  type: "rent" | "deposit";
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountMinor: bigint;
};

export type PlanInput = {
  rentMinor: bigint;
  currency: string;
  frequency: PaymentFrequency | "custom";
  installments: number;
  startDate: string;
  endDate: string;
  dueDay: number;
  depositMinor: bigint;
};

function dueOn(date: string, dueDay: number): string {
  const [year, month] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

/**
 * Mirror of `generate_lease_charges` in the database, used to preview a schedule before
 * activation and to pin the arithmetic in tests. `rentMinor` is the rent for one payment
 * period; each period is split into `installments` charges with the remainder on the last.
 */
export function planLeaseCharges(input: PlanInput): PlannedCharge[] {
  const { rentMinor, frequency, installments, startDate, endDate, dueDay, depositMinor } = input;

  // shortcut: custom schedules are user-entered rows, added with the amendments work after M2.
  if (frequency === "custom") throw new Error("custom payment schedules are not supported yet");
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) throw new Error("invalid lease dates");
  if (endDate <= startDate) throw new Error("end date must be after start date");
  if (installments < 1) throw new Error("installments must be at least 1");

  const periodMonths = FREQUENCY_MONTHS[frequency];
  const firstPeriodEnd = addMonthsISO(startDate, periodMonths);
  if (firstPeriodEnd > endDate) throw new Error("lease term is shorter than one payment period");

  const rows: PlannedCharge[] = [];
  const share = rentMinor / BigInt(installments);
  const remainder = rentMinor - share * BigInt(installments);
  let cursor = startDate;

  for (let guard = 0; cursor < endDate; guard += 1) {
    if (guard > 1200) throw new Error("lease schedule exceeds 100 years");

    const periodLimit = addMonthsISO(cursor, periodMonths);
    const periodEnd = periodLimit < endDate ? periodLimit : endDate;

    for (let index = 0; index < installments; index += 1) {
      const offset = Math.floor((index * periodMonths) / installments);
      const nextOffset = Math.floor(((index + 1) * periodMonths) / installments);
      const periodStart = addMonthsISO(cursor, offset);
      const chargeEnd = index === installments - 1 ? periodEnd : addMonthsISO(cursor, nextOffset);
      rows.push({
        type: "rent",
        periodStart,
        periodEnd: chargeEnd < periodEnd ? chargeEnd : periodEnd,
        dueDate: dueOn(periodStart, dueDay),
        amountMinor: index === installments - 1 ? share + remainder : share,
      });
    }

    cursor = periodEnd;
  }

  if (depositMinor > 0n) {
    rows.push({
      type: "deposit",
      periodStart: startDate,
      periodEnd: startDate,
      dueDate: startDate,
      amountMinor: depositMinor,
    });
  }

  return rows;
}
