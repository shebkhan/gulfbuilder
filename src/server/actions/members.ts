"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { emailField } from "@/schemas/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: emailField,
  role: z.enum(["manager", "accountant", "caretaker", "owner", "tenant"]),
  locale: z.enum(["en", "ar"]),
});

export type InviteState = { error?: string; invited?: string };

export async function inviteMemberAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  // Authorisation runs on the user session; the service role is only used to send the invite.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authorised" };

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (membership?.role !== "org_admin") return { error: "not_authorised" };

  const origin = await requestOrigin();
  const admin = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=/${parsed.data.locale}/dashboard` },
  );
  if (inviteError) {
    return { error: inviteError.message.includes("already") ? "already_member" : "invite_failed" };
  }

  const { error: memberError } = await supabase
    .from("org_members")
    .insert({ org_id: membership.org_id, user_id: invited.user.id, role: parsed.data.role });
  if (memberError) return { error: "already_member" };

  revalidatePath(`/${parsed.data.locale}/settings/users`);
  return { invited: parsed.data.email };
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
