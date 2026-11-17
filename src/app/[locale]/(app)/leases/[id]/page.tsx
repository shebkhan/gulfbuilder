import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeaseActions } from "@/components/domain/lease-actions";
import { LeaseSchedule } from "@/components/domain/lease-schedule";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("leases");
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // 1. Fetch lease with tenant and unit details
  const { data: lease } = await ctx.supabase
    .from("leases")
    .select(`
      *,
      tenants!inner ( id, full_name, phone ),
      units ( id, unit_no, building_id, buildings ( id, code, name ) )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!lease) notFound();

  // 2. Fetch charges for this lease
  const { data: rawCharges } = await ctx.supabase
    .from("charges")
    .select("*")
    .eq("lease_id", id)
    .order("period_start", { ascending: true })
    .order("due_date", { ascending: true });

  const charges = rawCharges ?? [];

  const tenant = lease.tenants as unknown as { id: string; full_name: string; phone: string | null };
  const unitData = lease.units as unknown as {
    id: string;
    unit_no: string;
    buildings: { id: string; name: string; code: string } | null;
  } | null;

  const canWrite = can(ctx.role, "leases.write");
  const canApprove = can(ctx.role, "leases.approve");

  const getStatusVariant = (s: string) => {
    switch (s) {
      case "active":
        return "success";
      case "draft":
        return "info";
      case "terminated":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/leases"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t("allLeases")}</span>
        </Link>
      </div>

      <PageHeader
        section="leases"
        role={ctx.role}
        title={lease.lease_no}
        description={
          <>
            <Link
              href={`/tenants/${tenant.id}`}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {tenant.full_name}
            </Link>
            {unitData ? (
              <>
                {" · "}
                {unitData.buildings ? (
                  <Link
                    href={`/buildings/${unitData.buildings.id}`}
                    className="text-primary hover:underline underline-offset-4"
                  >
                    {unitData.buildings.name}
                  </Link>
                ) : null}
                {` (${unitData.unit_no})`}
              </>
            ) : ""}
          </>
        }
        actions={
          <>
            <Badge variant={getStatusVariant(lease.status)}>
              {t(`statuses.${lease.status}`)}
            </Badge>
            <LeaseActions
              leaseId={lease.id}
              status={lease.status}
              isSublet={!!lease.parent_lease_id}
              subletApproved={!!lease.sublet_approved_by}
              canWrite={canWrite}
              canApprove={canApprove}
              labels={{
                activate: t("activate"),
                activating: t("activating"),
                terminate: t("terminate"),
                terminating: t("terminating"),
                renew: t("renew"),
                renewing: t("renewing"),
                approveSublet: t("approveSublet"),
                approving: t("approving"),
                terminationDate: t("terminationDate"),
                terminationReason: t("terminationReason"),
                startDate: t("startDate"),
                endDate: t("endDate"),
                rent: t("rent"),
                frequency: t("frequency"),
                installments: t("installments"),
                dueDay: t("dueDay"),
                deposit: t("deposit"),
                cancel: t("cancel"),
              }}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("facts")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-hairline">
            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("startDate")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface" dir="ltr">
                {lease.start_date}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("endDate")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface" dir="ltr">
                {lease.end_date}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("rent")}</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">
                {formatMoney(BigInt(lease.rent_minor), lease.currency)}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("frequency")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {t(`frequencies.${lease.payment_frequency}`)}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("installments")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {lease.installments}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("dueDay")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {lease.due_day}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("deposit")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {formatMoney(BigInt(lease.deposit_minor), lease.currency)}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("noticeDays")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {lease.notice_days}
              </span>
            </div>

            {lease.parent_lease_id ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("isSublet")}</span>
                <Badge variant={lease.sublet_approved_by ? "success" : "warning"}>
                  {lease.sublet_approved_by ? t("subletApproved") : "Pending Approval"}
                </Badge>
              </div>
            ) : null}

            {lease.terminated_at ? (
              <div className="flex flex-col gap-1 py-2 text-error">
                <span className="font-body-sm text-body-sm">{t("terminated")}: {lease.terminated_at}</span>
                {lease.termination_reason ? (
                  <span className="font-body-xs text-body-xs">{lease.termination_reason}</span>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("schedule")}</CardTitle>
          </CardHeader>
          <CardBody>
            <LeaseSchedule
              charges={charges}
              labels={{
                type: t("type"),
                period: t("period"),
                dueDate: t("dueDate"),
                amount: t("amount"),
                paid: t("paid"),
                status: t("chargeStatus"),
                noCharges: t("noCharges"),
                chargeTypes: t.raw("chargeTypes") as Record<string, string>,
                chargeStatuses: t.raw("chargeStatuses") as Record<string, string>,
              }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

