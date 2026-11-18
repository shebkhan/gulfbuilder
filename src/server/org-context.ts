import { cache } from "react";
import { resolveCurrency } from "@/lib/currency";
import { isRole, type Role } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type OrgContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  role: Role;
  currency: string;
};

export type Membership = Pick<OrgContext, "orgId" | "role" | "currency">;

/**
 * Active membership for a user. RLS still decides what the session may read; this
 * only decides which organization the request is scoped to.
 */
export async function resolveMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
  preferredOrgId?: string,
): Promise<Membership | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .maybeSingle();

  const findMembership = async (orgId?: string) => {
    let query = supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", userId);
    if (orgId) query = query.eq("org_id", orgId);
    const { data } = await query.order("created_at").limit(1).maybeSingle();
    return data;
  };

  // The JWT hook uses profiles.active_org_id; match it so RLS and app checks agree.
  const activeOrgId = profile?.active_org_id ?? undefined;
  const membership =
    (activeOrgId ? await findMembership(activeOrgId) : null) ??
    (preferredOrgId && preferredOrgId !== activeOrgId
      ? await findMembership(preferredOrgId)
      : null) ??
    (await findMembership());
  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", membership.org_id)
    .maybeSingle();

  return {
    orgId: membership.org_id,
    role: isRole(membership.role) ? membership.role : "tenant",
    currency: resolveCurrency(org?.base_currency),
  };
}

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

  const membership = await resolveMembership(supabase, user.id);
  if (!membership) return null;

  return { supabase, userId: user.id, ...membership };
});
