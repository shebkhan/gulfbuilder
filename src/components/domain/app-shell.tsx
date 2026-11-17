import { Bell, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Role } from "@/lib/rbac";
import { signOutAction } from "@/server/actions/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { FOOTER_NAV, NAV_ITEMS, visibleNav, type NavItem } from "./nav-items";
import { SidebarNav, type SidebarItem } from "./sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
  orgName: string;
  currency: string;
  role: Role;
  userName: string;
  locale: string;
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
  items,
  footerItems,
}: AppShellProps) {
  const t = await getTranslations();

  const toItems = (nav: NavItem[]): SidebarItem[] =>
    nav.map((item) => ({ href: item.href, label: t(`nav.${item.labelKey}`), icon: item.labelKey }));

  const nav = toItems(visibleNav(role, items ?? NAV_ITEMS));
  const footer = toItems(visibleNav(role, footerItems ?? FOOTER_NAV));

  return (
    <div className="min-h-screen bg-surface-container-low p-margin-mobile lg:p-margin">
      {/* Master canvas: 28px radius, warm ambient shadow, hairline perimeter. */}
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden rounded-frame bg-surface-container-lowest shadow-canvas lg:min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-[210px] shrink-0 flex-col justify-between border-e border-surface-container-high px-3 py-6 lg:flex">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col px-3 pb-2">
              <span className="truncate font-headline-sm text-label-md leading-tight font-semibold tracking-tight text-on-surface">
                {orgName}
              </span>
              <span className="font-section-kicker text-[9px] uppercase tracking-widest text-on-surface-variant">
                {t("common.appTagline")}
              </span>
            </div>
            <SidebarNav items={nav} />
          </div>
          {footer.length > 0 && <SidebarNav items={footer} />}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface shadow-sm">
              <span className="max-w-[40vw] truncate font-medium">{orgName}</span>
              <span className="text-outline">•</span>
              <span className="font-metric-num-sm text-label-sm tracking-wider text-primary">
                {currency}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <button
                type="button"
                aria-label={t("common.notifications")}
                className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <Bell className="size-5" />
                <span className="absolute end-2 top-2 size-2 rounded-full bg-primary" />
              </button>
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
                <button
                  type="submit"
                  title={t("common.signOut")}
                  aria-label={t("common.signOut")}
                  className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  <LogOut className="size-[18px]" />
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 px-6 pb-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
