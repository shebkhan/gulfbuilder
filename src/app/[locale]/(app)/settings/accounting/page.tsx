import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PeriodControls } from "@/components/domain/period-controls";
import { SettingsNav } from "@/components/domain/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const role = membership && isRole(membership.role) ? membership.role : "tenant";
  if (!can(role, "ledger.close")) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("settings.accounting");

  const { data: periods } = await supabase
    .from("accounting_periods")
    .select("month, status, closed_at, closed_by")
    .order("month", { ascending: false })
    .limit(24);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("periods")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!periods || periods.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("noPeriods")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("month")}</th>
                    <th className="p-3 text-start">{t("status")}</th>
                    <th className="p-3 text-start">{t("closedAt")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {periods.map((p) => (
                    <tr key={p.month}>
                      <td className="p-3 font-medium text-on-surface">{p.month}</td>
                      <td className="p-3">
                        <Badge variant={p.status === "closed" ? "success" : "neutral"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {p.closed_at ? new Date(p.closed_at).toLocaleString(locale) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <PeriodControls />
    </div>
  );
}
