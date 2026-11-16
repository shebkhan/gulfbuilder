import { redirect } from "next/navigation";

/** Only the team screen exists so far; it is the settings landing page for now. */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/settings/users`);
}
