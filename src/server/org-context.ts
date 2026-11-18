import { cache } from "react";
import { resolveCurrency } from "@/lib/currency";
import { isRole, type Role } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  orgId: string;
  role: Role;
  currency: string;
};

/**
 * Session + active membership in one place. Returns null instead of redirecting so
 * server actions can answer with an error code. Cached per request: pages and the
 * fetch helpers they call all share one lookup.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .maybeSingle();

  const findMembership = async (orgId?: string) => {
    let query = supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id);
    if (orgId) query = query.eq("org_id", orgId);
    const { data } = await query.order("created_at").limit(1).maybeSingle();
    return data;
  };

  // The JWT hook uses profiles.active_org_id; match it so RLS and app checks agree.
  const membership =
    (profile?.active_org_id ? await findMembership(profile.active_org_id) : null) ??
    (await findMembership());
  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", membership.org_id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    orgId: membership.org_id,
    role: isRole(membership.role) ? membership.role : "tenant",
    currency: resolveCurrency(org?.base_currency),
  };
});
