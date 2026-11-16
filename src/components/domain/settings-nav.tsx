import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const SECTIONS = [
  { href: "/settings/users", labelKey: "users" },
  { href: "/settings/organization", labelKey: "organization" },
  { href: "/settings/branding", labelKey: "branding" },
  { href: "/settings/accounting", labelKey: "accounting" },
  { href: "/settings/notifications", labelKey: "notifications" },
  { href: "/settings/audit", labelKey: "audit" },
  { href: "/settings/export", labelKey: "export" },
] as const;

/** Settings sub-navigation shared by every settings screen. */
export async function SettingsNav() {
  const t = await getTranslations("settings");

  return (
    <nav className="flex flex-wrap gap-2 border-b border-hairline pb-3">
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="rounded-full border border-hairline px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          {t(`sections.${section.labelKey}` as never)}
        </Link>
      ))}
    </nav>
  );
}
