import { z } from "zod";

/** Wire shape for the dashboard. Money stays in minor units plus a currency code. */
export const dashboardKpisSchema = z.object({
  total_units: z.number().int(),
  occupied_units: z.number().int(),
  vacant_units: z.number().int(),
  occupancy_pct: z.number(),
  monthly_rent_roll: z.number(),
  ytd_collections: z.number(),
  ytd_expenses: z.number(),
  net_operating_income: z.number(),
  overdue_receivables: z.number(),
});

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;

export const dashboardSchema = z.object({
  kpis: dashboardKpisSchema.nullable(),
  expiringLeases: z.array(
    z.object({
      lease_id: z.string(),
      lease_no: z.string(),
      tenant_name: z.string(),
      end_date: z.string(),
      days_left: z.number().int(),
    }),
  ),
  openMaintenance: z.number().int(),
  upcomingCheques: z.array(
    z.object({
      id: z.string(),
      cheque_no: z.string(),
      bank_name: z.string().nullable(),
      amount_minor: z.number(),
      currency: z.string(),
      cheque_date: z.string(),
      status: z.string(),
      tenant_name: z.string().nullable(),
    }),
  ),
  recentPayments: z.array(
    z.object({
      id: z.string(),
      receipt_no: z.number().int().nullable(),
      receipt_year: z.number().int().nullable(),
      amount_minor: z.number(),
      currency: z.string(),
      method: z.string(),
      received_at: z.string(),
      tenant_name: z.string().nullable(),
    }),
  ),
  recentMaintenance: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      priority: z.string(),
      status: z.string(),
      opened_at: z.string(),
      building_code: z.string().nullable(),
      unit_no: z.string().nullable(),
    }),
  ),
  buildings: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      units: z.array(z.object({ id: z.string(), status: z.string() })),
    }),
  ),
});

export type DashboardData = z.infer<typeof dashboardSchema>;
