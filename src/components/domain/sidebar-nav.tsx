"use client";

import {
  Banknote,
  BarChart3,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  Gauge,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
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
  statements: Receipt,
  payouts: Banknote,
  approvals: ClipboardCheck,
  documents: FileText,
  meters: Gauge,
  platform: Building2,
  marketPacks: FileText,
};

export type SidebarItem = { href: string; label: string; icon: string };

export function SidebarNav({ items, compact = false }: { items: SidebarItem[]; compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            aria-current={isActive ? "page" : undefined}
            aria-label={compact ? item.label : undefined}
            title={compact ? item.label : undefined}
            className={cn(
              "flex items-center rounded-lg py-2 font-label-md text-label-md transition-all",
              compact ? "justify-center px-2" : "gap-3 px-3",
              isActive
                ? "bg-surface-container font-medium text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {compact ? null : <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
