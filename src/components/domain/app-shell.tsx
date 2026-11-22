import { Bell, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/rbac";
import { signOutAction } from "@/server/actions/auth";
import { CollapsibleSidebar } from "./collapsible-sidebar";
import { LocaleSwitcher } from "./locale-switcher";
import { FOOTER_NAV, NAV_ITEMS, visibleNav, type NavItem } from "./nav-items";
import { type SidebarItem } from "./sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
  orgName: string;
  currency: string;
  role: Role;
  userName: string;
  locale: string;
  logoUrl?: string | null;
  /** Overrides the staff navigation (the owner portal passes its own). */
  items?: NavItem[];
  footerItems?: NavItem[];
};

export async function AppShell({
  children,
  orgName,
  currency,
  role,
  userName,
  locale,
  logoUrl,
  items,
  footerItems,
}: AppShellProps) {
  const t = await getTranslations();

  const toItems = (nav: NavItem[]): SidebarItem[] =>
    nav.map((item) => ({
      href: item.href,
      label: t(`nav.${item.labelKey}`),
      icon: item.labelKey,
    }));

  const nav = toItems(visibleNav(role, items ?? NAV_ITEMS));
  const footer = toItems(visibleNav(role, footerItems ?? FOOTER_NAV));

  return (
    <div className="auth-backdrop min-h-screen p-margin-mobile lg:p-margin">
      {/* Master canvas: 28px radius, warm ambient shadow, hairline perimeter. */}
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden rounded-frame bg-gradient-to-br from-surface-container-lowest/95 via-surface-container-lowest/85 to-surface-container/65 shadow-frame lg:min-h-[calc(100vh-4rem)]">
        <CollapsibleSidebar
          orgName={orgName}
          logoUrl={logoUrl}
          tagline={t("common.appTagline")}
          nav={nav}
          footer={footer}
          collapseLabel={t("common.collapseSidebar")}
          expandLabel={t("common.expandSidebar")}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl ?? "/icons/icon.svg"} alt="" className="size-5 shrink-0 object-contain" />
              <span className="max-w-[40vw] truncate font-medium">{orgName}</span>
              <span className="text-outline">•</span>
              <span className="font-metric-num-sm text-label-sm tracking-wider text-primary">
                {currency}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("common.notifications")}
                className="relative"
              >
                <Bell />
                <span className="absolute end-2 top-2 size-2 rounded-full bg-primary" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-surface-container font-label-md font-medium text-on-surface">
                  {userName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden flex-col md:flex">
                  <span className="max-w-[10rem] truncate font-label-md text-label-md font-medium leading-none text-on-surface">
                    {userName}
                  </span>
                  <span className="mt-0.5 font-label-sm text-label-sm leading-tight text-on-surface-variant">
                    {role}
                  </span>
                </div>
              </div>
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  title={t("common.signOut")}
                  aria-label={t("common.signOut")}
                >
                  <LogOut />
                </Button>
              </form>
            </div>
          </header>

          <main id="main-content" className="flex-1 px-6 pb-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
