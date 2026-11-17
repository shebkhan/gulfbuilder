"use client";

import { useState } from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Gauge,
  Hourglass,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  properties: Building2,
  buildings: Building2,
  tenants: Users,
  leases: FileSignature,
  payments: CreditCard,
  cheques: Banknote,
  deposits: PiggyBank,
  expenses: Receipt,
  maintenance: Wrench,
  inspections: ClipboardCheck,
  reports: BarChart3,
  settings: Settings,
  rentRoll: FileSignature,
  receivables: CreditCard,
  statements: FileSpreadsheet,
  payouts: Banknote,
  approvals: ClipboardCheck,
  documents: FileText,
  meters: Gauge,
  platform: Building2,
  marketPacks: FileText,
  occupancy: Building2,
  expiry: CalendarDays,
  collections: CreditCard,
  agedReceivables: Hourglass,
  cashFlowForecast: TrendingUp,
};

export type SidebarItem = {
  href: string;
  label: string;
  icon: string;
  children?: SidebarItem[];
};

export function SidebarNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <SidebarNavItem key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function SidebarNavItem({ item, pathname }: { item: SidebarItem; pathname: string }) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;
  const hasChildren = item.children && item.children.length > 0;

  // Active check
  const isDirectActive = pathname === item.href;
  const isSubActive = Boolean(item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)));
  const isActive = isDirectActive || (!hasChildren && pathname.startsWith(`${item.href}/`)) || isSubActive;

  // Collapsible state: automatically open if child is active or default open on report paths
  const [isOpen, setIsOpen] = useState(isActive);

  if (hasChildren) {
    return (
      <div className="flex flex-col gap-0.5">
        <div
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 font-label-md text-label-md transition-all group",
            isActive
              ? "bg-surface-container font-medium text-on-surface"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
          )}
        >
          <Link
            href={item.href}
            aria-current={isDirectActive ? "page" : undefined}
            className="flex flex-1 items-center gap-3"
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="flex size-6 items-center justify-center rounded p-0.5 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
            aria-label={`Toggle ${item.label}`}
            aria-expanded={isOpen}
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {isOpen && item.children ? (
          <div className="ms-4 flex flex-col gap-0.5 border-s border-hairline ps-2 pt-0.5">
            {item.children.map((child) => {
              const ChildIcon = ICONS[child.icon] ?? LayoutDashboard;
              const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  aria-current={isChildActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                    isChildActive
                      ? "bg-primary-fixed/40 font-semibold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                  )}
                >
                  <ChildIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 font-label-md text-label-md transition-all",
        isActive
          ? "bg-surface-container font-medium text-on-surface"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}
