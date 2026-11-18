import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { requiresMfa } from "@/lib/mfa";
import { isRole, type Role } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveMembership } from "@/server/org-context";
import type { Database } from "@/types/database";
import { ApiError } from "./errors";

export type ApiContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  role: Role;
};

/** Claims set by the access-token hook (D-009) once it is enabled. */
type HookClaims = { sub?: string; org_id?: string; org_role?: string; aal?: string };

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Resolves the caller from either the web session cookie (in-process calls) or a
 * mobile `Authorization: Bearer` token. Both end up as the same user-scoped client,
 * so RLS stays the gate on every query.
 */
export async function requireApiContext(request: NextRequest): Promise<ApiContext> {
  const token = bearerToken(request);

  if (!token) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("unauthorized");
    return build(supabase, user.id, null);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new ApiError("unauthorized");

  const claims = data.claims as HookClaims;
  if (!claims.sub) throw new ApiError("unauthorized");
  return build(supabase, claims.sub, claims);
}

async function build(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims: HookClaims | null,
): Promise<ApiContext> {
  // With the hook enabled the token carries org and role; skip the membership queries.
  if (claims?.org_id && claims.org_role && isRole(claims.org_role)) {
    const role = claims.org_role;
    if (requiresMfa(role) && claims.aal !== "aal2") throw new ApiError("mfa_required");
    return { supabase, userId, orgId: claims.org_id, role };
  }

  const membership = await resolveMembership(supabase, userId, claims?.org_id);
  if (!membership) throw new ApiError("forbidden", "No organization membership");

  // Cookie callers already passed the web MFA gate; bearer callers did not.
  if (claims && requiresMfa(membership.role) && claims.aal !== "aal2") {
    throw new ApiError("mfa_required");
  }

  return { supabase, userId, orgId: membership.orgId, role: membership.role };
}
