import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsNav } from "@/components/domain/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuditSettingsPage({
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
  if (!can(role, "settings.write")) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("settings.audit");

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, table_name, row_id, action, actor_id, at")
    .order("at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!rows || rows.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("when")}</th>
                    <th className="p-3 text-start">{t("table")}</th>
                    <th className="p-3 text-start">{t("action")}</th>
                    <th className="p-3 text-start">{t("row")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="p-3 text-on-surface-variant">
                        {new Date(row.at).toLocaleString(locale)}
                      </td>
                      <td className="p-3 font-medium text-on-surface">{row.table_name}</td>
                      <td className="p-3">
                        <Badge variant="neutral">{row.action}</Badge>
                      </td>
                      <td className="p-3 font-mono text-xs text-on-surface-variant">
                        {row.row_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
