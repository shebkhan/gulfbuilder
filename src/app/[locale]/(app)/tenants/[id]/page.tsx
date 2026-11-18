import { ArrowLeft, ArrowRight, ExternalLink, FileSignature } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TenantIdReveal } from "@/components/domain/tenant-id-reveal";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { maskId } from "@/lib/mask";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

/** The unit a lease belongs to, with the building it sits in. */
type UnitRef = {
  id: string;
  unit_no: string;
  buildings: { id: string; name: string; code: string } | null;
} | null;

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("tenants");
  const tl = await getTranslations("leases");
  const tc = await getTranslations("common");
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const { data: tenant } = await ctx.supabase
    .from("tenant_directory")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant) notFound();

  // Get tenant leases, with the unit and building each one belongs to.
  const { data: leases } = await ctx.supabase
    .from("leases")
    .select(
      `
      id, lease_no, start_date, end_date, rent_minor, currency, status, unit_id, room_id,
      units ( id, unit_no, buildings ( id, name, code ) ),
      rooms ( units ( id, unit_no, buildings ( id, name, code ) ) )
    `,
    )
    .eq("tenant_id", id)
    .order("start_date", { ascending: false });

  // If user has tenants.write, get masked ID
  let maskedId: string | null = null;
  const canSeeId = can(ctx.role, "tenants.write");
  if (canSeeId) {
    const { data: plainId } = await ctx.supabase.rpc("tenant_id_number", {
      p_tenant: id,
    });
    if (plainId) {
      maskedId = maskId(plainId);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/tenants"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t("allTenants")}</span>
        </Link>
      </div>

      <PageHeader
        section="tenants"
        role={ctx.role}
        title={tenant.full_name}
        description={tenant.nationality || ""}
        actions={
          <>
            <Badge variant="neutral">
              {tenant.kind === "company" ? t("company") : t("person")}
            </Badge>
            {can(ctx.role, "leases.write") ? (
              <Link
                href={`/leases/new?tenantId=${tenant.id}`}
                className="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary/90"
              >
                {tl("new")}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("facts")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-hairline">
            {canSeeId && maskedId ? (
              <TenantIdReveal
                tenantId={id}
                initialMasked={maskedId}
                labels={{
                  idNumber: t("idNumber"),
                  reveal: t("reveal"),
                  revealing: t("revealing"),
                  hide: t("hide"),
                  copy: t("copy"),
                  copied: t("copied"),
                }}
              />
            ) : null}

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("kind")}</span>
              <span className="font-body-sm text-body-sm font-medium text-on-surface">
                {tenant.kind === "company" ? t("company") : t("person")}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {t("language")}
              </span>
              <span className="font-body-sm text-body-sm font-medium uppercase text-on-surface">
                {tenant.language}
              </span>
            </div>

            {tenant.phone ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {t("phone")}
                </span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface" dir="ltr">
                  {tenant.phone}
                </span>
              </div>
            ) : null}

            {tenant.whatsapp ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {t("whatsapp")}
                </span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface" dir="ltr">
                  {tenant.whatsapp}
                </span>
              </div>
            ) : null}

            {tenant.email ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {t("email")}
                </span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">
                  {tenant.email}
                </span>
              </div>
            ) : null}

            {tenant.employer ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {t("employer")}
                </span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">
                  {tenant.employer}
                </span>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("leases")}</CardTitle>
          </CardHeader>
          <CardBody>
            {leases && leases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-start font-body-sm text-body-sm">
                  <thead>
                    <tr className="border-b border-hairline text-on-surface-variant">
                      <th className="py-2 text-start font-medium">{tl("building")}</th>
                      <th className="py-2 text-start font-medium">{tl("unit")}</th>
                      <th className="py-2 text-start font-medium">{tl("startDate")}</th>
                      <th className="py-2 text-start font-medium">{tl("endDate")}</th>
                      <th className="py-2 text-start font-medium">{tc("daysLeftHeader")}</th>
                      <th className="py-2 text-end font-medium">{tl("rent")}</th>
                      <th className="py-2 text-center font-medium">{tl("filterStatus")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {leases.map((lease) => {
                      const unit =
                        (lease.units as unknown as UnitRef) ??
                        (lease.rooms as unknown as { units: UnitRef } | null)?.units ??
                        null;
                      const building = unit?.buildings ?? null;

                      return (
                        <tr key={lease.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 text-on-surface">
                            {building ? (
                              <Link
                                href={`/buildings/${building.id}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {building.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 pe-6 text-on-surface-variant">
                            {unit ? (
                              <Link
                                href={`/units/${unit.id}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {unit.unit_no}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 text-on-surface-variant">
                            <DateCell date={lease.start_date} locale={locale} />
                          </td>
                          <td className="py-2.5 text-on-surface-variant">
                            <DateCell date={lease.end_date} locale={locale} />
                          </td>
                          <td className="py-2.5">
                            <DaysLeft date={lease.end_date} />
                          </td>
                          <td className="py-2.5 text-end font-medium text-on-surface">
                            {formatMoney(BigInt(lease.rent_minor), lease.currency)}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className="flex items-center justify-center gap-1.5">
                              <Badge
                                variant={
                                  lease.status === "active"
                                    ? "success"
                                    : lease.status === "draft"
                                      ? "info"
                                      : "neutral"
                                }
                              >
                                {tl(`statuses.${lease.status}`)}
                              </Badge>
                              <Link
                                href={`/leases/${lease.id}`}
                                title={tl("openLease")}
                                aria-label={tl("openLease")}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                              </Link>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileSignature className="mb-2 h-8 w-8 text-on-surface-variant/40" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">{t("noLeases")}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
