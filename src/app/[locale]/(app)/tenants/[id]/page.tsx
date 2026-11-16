import { ArrowLeft, ArrowRight, FileSignature } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TenantIdReveal } from "@/components/domain/tenant-id-reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { maskId } from "@/lib/mask";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

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
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const { data: tenant } = await ctx.supabase
    .from("tenant_directory")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant) notFound();

  // Get tenant leases
  const { data: leases } = await ctx.supabase
    .from("leases")
    .select("id, lease_no, start_date, end_date, rent_minor, currency, status, unit_id, room_id")
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{tenant.full_name}</h1>
            <Badge variant="neutral">
              {tenant.kind === "company" ? t("company") : t("person")}
            </Badge>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {tenant.nationality || ""}
          </p>
        </div>

        {can(ctx.role, "leases.write") ? (
          <Link
            href={`/leases/new?tenantId=${tenant.id}`}
            className="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary/90"
          >
            {tl("new")}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("facts")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-hairline">
            {canSeeId && maskedId ? (
              <TenantIdReveal
                tenantId={tenant.id}
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
              <span className="font-body-sm font-medium text-body-sm text-on-surface">
                {tenant.kind === "company" ? t("company") : t("person")}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="font-body-sm text-body-sm text-on-surface-variant">{t("language")}</span>
              <span className="font-body-sm font-medium text-body-sm text-on-surface uppercase">
                {tenant.language}
              </span>
            </div>

            {tenant.phone ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("phone")}</span>
                <span className="font-body-sm font-medium text-body-sm text-on-surface" dir="ltr">
                  {tenant.phone}
                </span>
              </div>
            ) : null}

            {tenant.whatsapp ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("whatsapp")}</span>
                <span className="font-body-sm font-medium text-body-sm text-on-surface" dir="ltr">
                  {tenant.whatsapp}
                </span>
              </div>
            ) : null}

            {tenant.email ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("email")}</span>
                <span className="font-body-sm font-medium text-body-sm text-on-surface">
                  {tenant.email}
                </span>
              </div>
            ) : null}

            {tenant.employer ? (
              <div className="flex justify-between py-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">{t("employer")}</span>
                <span className="font-body-sm font-medium text-body-sm text-on-surface">
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
              <div className="flex flex-col divide-y divide-hairline">
                {leases.map((lease) => (
                  <Link
                    key={lease.id}
                    href={`/leases/${lease.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-surface-container-low/50 px-2 rounded-lg"
                  >
                    <div className="flex flex-col">
                      <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                        {lease.lease_no}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {lease.start_date} → {lease.end_date}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-title-sm text-title-sm text-on-surface">
                        {formatMoney(lease.rent_minor, lease.currency)}
                      </span>
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
                    </div>
                  </Link>
                ))}
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
