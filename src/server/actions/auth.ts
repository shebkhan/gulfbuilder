"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createOrgSchema, resetSchema, signInSchema, signUpSchema, type AuthState, type OrgState } from "@/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LOCALE = "en";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function localeFromForm(formData: FormData) {
  const value = formData.get("locale");
  return value === "ar" ? "ar" : DEFAULT_LOCALE;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeFromForm(formData);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.status === 400 ? "invalid_credentials" : "auth_failed" };

  revalidatePath(`/${locale}`, "layout");
  redirect(await landingPath(supabase, locale));
}

/** Tenants land in the tenant portal, owners in the owner portal, everyone else in the app. */
export async function landingPath(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  locale: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return `/${locale}/login`;

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (membership?.role === "tenant") return `/${locale}/portal`;
  if (membership?.role === "owner") return `/${locale}/owner`;
  return `/${locale}/dashboard`;
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeFromForm(formData);
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/callback?next=/${locale}/onboarding`,
    },
  });
  if (error) return { error: "auth_failed" };

  // Email confirmation is on for hosted projects: the session may not exist yet.
  return { error: "check_email" };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeFromForm(formData);
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/${locale}/set-password`,
  });
  if (error) return { error: "auth_failed" };

  return { error: "check_email" };
}

export async function setPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeFromForm(formData);
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "auth_failed" };

  redirect(`/${locale}/dashboard`);
}

export async function signOutAction(formData: FormData) {
  const locale = localeFromForm(formData);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

export async function createOrganizationAction(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  const locale = localeFromForm(formData);
  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    countryCode: formData.get("countryCode"),
    baseCurrency: formData.get("baseCurrency"),
    locale: formData.get("uiLocale") ?? locale,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_country_code: parsed.data.countryCode,
    p_base_currency: parsed.data.baseCurrency,
    p_locale: parsed.data.locale,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/dashboard`);
}
