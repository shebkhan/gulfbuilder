import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serviceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role client: bypasses RLS.
 * Only for Edge Functions, the `(platform)` route group, and the notification
 * worker/dispatch route (SPEC/CLAUDE architecture rules).
 */
export function createSupabaseAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
