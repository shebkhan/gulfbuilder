"use client";

import { FileText, Home, Receipt, Wallet, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Mobile-first shell for the tenant portal (SPEC §8 T1). Staff use `AppShell`;
 * the portal is a phone surface with a bottom navigation bar.
 */

const ITEMS = [
  { href: "/portal", labelKey: "home", icon: Home },
  { href: "/portal/statement", labelKey: "statement", icon: Receipt },
  { href: "/portal/payments", labelKey: "payments", icon: Wallet },
  { href: "/portal/requests", labelKey: "requests", icon: Wrench },
  { href: "/portal/documents", labelKey: "documents", icon: FileText },
] as const;

export function PortalBottomNav() {
  const t = useTranslations("portal.nav");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface-container-lowest pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
