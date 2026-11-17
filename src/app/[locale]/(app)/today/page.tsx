import { Banknote, CreditCard, FileSignature, Wrench, type LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { daysUntil, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { mergeTodayItems, type TodayKind, type TodayRow } from "@/lib/today";
import { getOrgContext } from "@/server/org-context";

type TenantRef = { full_name: string } | null;

type ChequeRow = {
  id: string;
  cheque_no: string;
  bank_name: string;
  amount_minor: number | string;
  currency: string;
  cheque_date: string;
  status: string;
  tenants: TenantRef;
};

type RepairRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  opened_at: string;
  buildings: { code: string } | null;
  units: { unit_no: string } | null;
};

type ConfirmationRow = {
  id: string;
  receipt_no: number;
  receipt_year: number;
  amount_minor: number | string;
  currency: string;
  method: string;
  received_at: string;
  tenants: TenantRef;
};

type LeaseRow = {
  lease_id: string;
  lease_no: string;
  tenant_name: string;
  end_date: string;
  days_left: number;
};

type Priority = "urgent" | "high" | "normal" | "low";
type BadgeVariant = "danger" | "warning" | "info" | "neutral";

const PRIORITIES: readonly Priority[] = ["urgent", "high", "normal", "low"];
const PRIORITY_URGENCY: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const KIND_ICONS: Record<TodayKind, LucideIcon> = {
  repair: Wrench,
  cheque: Banknote,
  confirmation: CreditCard,
  lease: FileSignature,
};

function badgeVariant(kind: TodayKind, urgency: number): BadgeVariant {
  if (kind === "repair") return urgency === 0 ? "danger" : urgency === 1 ? "warning" : "neutral";
  if (kind === "cheque") return urgency < 0 ? "danger" : "warning";
  if (kind === "lease") return urgency <= 7 ? "danger" : "warning";
  return "info";
}

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;
  if (!can(ctx.role, "dailyTasks.read")) redirect("/dashboard");

  const t = await getTranslations("today");
  const today = todayISO();

  const [chequeResult, repairResult, leaseResult, confirmationResult] = await Promise.all([
    ctx.supabase
      .from("cheques")
      .select(
        "id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, tenants(full_name)",
        { count: "exact" },
      )
      .in("status", ["received", "deposited"])
      .lte("cheque_date", today)
      .order("cheque_date", { ascending: true })
      .limit(3),
    ctx.supabase
      .from("maintenance_requests")
      .select("id, title, priority, status, opened_at, buildings(code), units(unit_no)", {
        count: "exact",
      })
      .in("status", ["open", "in_progress"])
      .order("opened_at", { ascending: true })
      .limit(3),
    ctx.supabase.rpc("leases_expiring", { p_days: 30 }),
    ctx.supabase
      .from("payments")
      .select(
        "id, receipt_no, receipt_year, amount_minor, currency, method, received_at, tenants(full_name)",
        { count: "exact" },
      )
      .eq("status", "pending_confirmation")
      .order("received_at", { ascending: true })
      .limit(3),
  ]);

  const cheques = (chequeResult.data ?? []) as unknown as ChequeRow[];
  const repairs = (repairResult.data ?? []) as unknown as RepairRow[];
  const leases = (leaseResult.data ?? []) as unknown as LeaseRow[];
  const confirmations = (confirmationResult.data ?? []) as unknown as ConfirmationRow[];

  const repairItems: TodayRow[] = repairs.map((r) => {
    const priority = PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "normal";
    return {
      id: r.id,
      kind: "repair",
      href: "/maintenance",
      primary: r.title,
      secondary: [r.buildings?.code, r.units?.unit_no].filter(Boolean).join(" · "),
      badge: t(priority),
      urgency: PRIORITY_URGENCY[priority],
    };
  });

  const chequeItems: TodayRow[] = cheques.map((c) => {
    const days = daysUntil(c.cheque_date, today);
    return {
      id: c.id,
      kind: "cheque",
      href: "/cheques",
      primary: `#${c.cheque_no}`,
      secondary: [
        c.bank_name,
        c.tenants?.full_name,
        formatMoney(BigInt(c.amount_minor), c.currency, locale),
      ]
        .filter(Boolean)
        .join(" · "),
      badge: days < 0 ? t("overdue", { days: -days }) : t("dueToday"),
      urgency: days,
    };
  });

  const confirmationItems: TodayRow[] = confirmations.map((p) => ({
    id: p.id,
    kind: "confirmation",
    href: "/payments",
    primary: `#${p.receipt_year}-${String(p.receipt_no).padStart(4, "0")}`,
    secondary: [
      p.tenants?.full_name,
      formatMoney(BigInt(p.amount_minor), p.currency, locale),
    ]
      .filter(Boolean)
      .join(" · "),
    badge: t("awaiting"),
    urgency: 0,
  }));

  const leaseItems: TodayRow[] = leases.slice(0, 3).map((l) => ({
    id: l.lease_id,
    kind: "lease",
    href: `/leases/${l.lease_id}`,
    primary: l.lease_no,
    secondary: [l.tenant_name, l.end_date].filter(Boolean).join(" · "),
    badge: t("daysLeft", { days: l.days_left }),
    urgency: l.days_left,
  }));

  const items = mergeTodayItems({
    repair: repairItems,
    cheque: chequeItems,
    confirmation: confirmationItems,
    lease: leaseItems,
  });

  const counts = {
    repair: repairResult.count ?? 0,
    cheque: chequeResult.count ?? 0,
    confirmation: confirmationResult.count ?? 0,
    lease: leases.length,
  };
  const allClear = Object.values(counts).every((count) => count === 0);

  const summary = [
    { label: t("repairs"), count: counts.repair, href: "/maintenance", icon: Wrench },
    { label: t("cheques"), count: counts.cheque, href: "/cheques", icon: Banknote },
    { label: t("confirmations"), count: counts.confirmation, href: "/payments", icon: CreditCard },
    { label: t("leases"), count: counts.lease, href: "/leases?expiring=true", icon: FileSignature },
  ];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <PageHeader
        section="today"
        role={ctx.role}
        title={t("title")}
        description={t("description")}
      />
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {t("date", { date: formatDate(today, locale) })}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((cell) => {
          const Icon = cell.icon;
          return (
            <Link key={cell.href} href={cell.href} className="rounded-xl">
              <Card className="h-full transition-colors hover:bg-surface-container-high">
                <CardBody className="flex items-center gap-4 p-5">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div className="flex flex-col">
                    <KpiLabel>{cell.label}</KpiLabel>
                    <span className="font-headline-md text-headline-md font-bold text-on-surface">
                      {cell.count}
                    </span>
                    <span className="font-body-sm text-body-sm text-primary">{t("viewAll")}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      {allClear ? (
        <Card>
          <CardBody className="p-8 text-center font-body-md text-body-md text-on-surface-variant">
            {t("allClear")}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("priorityItems")}</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="flex flex-col divide-y divide-hairline">
              {items.map((item) => {
                const Icon = KIND_ICONS[item.kind];
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={item.href}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg py-3 hover:bg-surface-container-low"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md font-semibold text-on-surface">
                          {item.primary}
                        </span>
                        {item.secondary ? (
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {item.secondary}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant={badgeVariant(item.kind, item.urgency)}>{item.badge}</Badge>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
