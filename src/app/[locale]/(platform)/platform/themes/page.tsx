import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemePresetForm } from "@/components/domain/theme-preset-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PlatformThemes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform.themes");

  const admin = createSupabaseAdminClient();
  const { data: presets } = await admin.from("theme_presets").select("*").order("name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      {(presets ?? []).map((preset) => (
        <ThemePresetForm
          key={preset.code}
          initial={{
            code: preset.code,
            name: preset.name,
            primaryColor: preset.primary_color,
            secondaryColor: preset.secondary_color,
            fontFamily: preset.font_family,
            isDefault: preset.is_default,
          }}
        />
      ))}

      <ThemePresetForm />
    </div>
  );
}
