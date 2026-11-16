import { isRole, type Role } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  orgId: string;
  role: Role;
};

/**
 * Session + active membership in one place. Returns null instead of redirecting so
 * server actions can answer with an error code.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  return {
    supabase,
    userId: user.id,
    orgId: membership.org_id,
    role: isRole(membership.role) ? membership.role : "tenant",
  };
}
