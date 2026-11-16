import { Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TenantForm } from "@/components/domain/tenant-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{ q?: string }>;

export default async function TenantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { q } = await searchParams;
  const t = await getTranslations("tenants");
  const writable = can(ctx.role, "tenants.write");

  let query = ctx.supabase
    .from("tenant_directory")
    .select("id, full_name, kind, phone, whatsapp, email, language")
    .is("deleted_at", null)
    .order("full_name");

  if (q && q.trim()) {
    query = query.or(`full_name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`);
  }

  const [{ data: tenants }, { data: leases }] = await Promise.all([
    query,
    ctx.supabase.from("leases").select("tenant_id"),
  ]);

  const leaseCountByTenant = (leases ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.tenant_id] = (acc[l.tenant_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        </div>
      </div>

      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardBody>
            <TenantForm
              labels={{
                fullName: t("fullName"),
                kind: t("kind"),
                person: t("person"),
                company: t("company"),
                language: t("language"),
                arabic: t("arabic"),
                english: t("english"),
                idNumber: t("idNumber"),
                idNumberPlaceholder: t("idNumberPlaceholder"),
                phone: t("phone"),
                whatsapp: t("whatsapp"),
                email: t("email"),
                nationality: t("nationality"),
                employer: t("employer"),
                create: t("create"),
                creating: t("creating"),
                created: t("created"),
                errors: t.raw("errors") as Record<string, string>,
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <form method="get" className="max-w-md">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
          />
        </form>

        {tenants && tenants.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/tenants/${tenant.id}`}
                className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {tenant.full_name}
                    </span>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {tenant.kind === "company" ? t("company") : t("person")}
                    </span>
                  </div>
                  <Badge variant="neutral">
                    {t("leasesCount", { count: leaseCountByTenant[tenant.id] ?? 0 })}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
                  {tenant.phone ? <span dir="ltr">{tenant.phone}</span> : null}
                  {tenant.email ? <span>{tenant.email}</span> : null}
                  <span className="uppercase">{tenant.language}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface-container-low p-12 text-center">
            <Users className="mb-3 h-10 w-10 text-on-surface-variant/60" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
