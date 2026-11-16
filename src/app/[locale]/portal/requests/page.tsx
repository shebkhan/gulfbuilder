import { getTranslations, setRequestLocale } from "next-intl/server";
import { TenantRequestForm } from "@/components/domain/tenant-request-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantPortalData } from "@/server/queries/tenant-portal";

export default async function PortalRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("portal.requests");
  const data = await getTenantPortalData();
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {data.requests.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {data.requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {r.title}
                    </span>
                    <Badge variant={r.status === "resolved" ? "success" : "info"}>
                      {t(`status.${r.status}` as never)}
                    </Badge>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {new Date(r.opened_at).toLocaleDateString(locale)} ·{" "}
                    {t(`priorities.${r.priority}` as never)}
                  </span>
                  {r.description && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {r.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <TenantRequestForm />
    </div>
  );
}
