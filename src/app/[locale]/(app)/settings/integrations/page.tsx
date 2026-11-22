import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/server/org-context";
import { can } from "@/lib/rbac";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiKeyCreateForm } from "@/components/domain/api-key-create-form";
import { revokeApiKeyAction } from "@/server/actions/api-keys";

export default async function IntegrationsSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (!can(ctx.role, "settings.write")) redirect(`/${locale}/dashboard`);

  const supabase = ctx.supabase;

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, role, owner_id, scopes, expires_at, revoked_at, last_used_at, created_at")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integrations</h1>
      <Card>
        <CardHeader><CardTitle>Create API key</CardTitle></CardHeader>
        <CardBody>
          <ApiKeyCreateForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Existing keys</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead><tr><th>Name</th><th>Role</th><th>Revoked</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {(keys ?? []).map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>{k.role}</td>
                  <td>{k.revoked_at ? "yes" : "no"}</td>
                  <td>{k.last_used_at ?? "-"}</td>
                  <td>
                    {!k.revoked_at && (
                      <form action={revokeApiKeyAction}>
                        <input type="hidden" name="id" value={k.id} />
                        <Button type="submit" size="sm">Revoke</Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
