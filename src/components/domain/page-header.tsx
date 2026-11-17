import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FOOTER_NAV, NAV_ITEMS } from "@/components/domain/nav-items";
import { relatedHrefs, type RelatedSection } from "@/components/domain/related-links";
import { Link } from "@/i18n/navigation";
import type { Role } from "@/lib/rbac";

type PageHeaderProps = {
  section: RelatedSection;
  role: Role;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export async function PageHeader({
  section,
  role,
  title,
  description,
  actions,
}: PageHeaderProps) {
  const [t, tNav] = await Promise.all([getTranslations("common"), getTranslations("nav")]);
  const items = [...NAV_ITEMS, ...FOOTER_NAV];
  const links = relatedHrefs(section, role).map((href) => ({
    href,
    label: tNav(items.find((item) => item.href === href)!.labelKey as never),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">
          {t("relatedSections")}
        </span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-container-low px-3 py-1 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed"
          >
            {label}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
