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
};

export type SidebarItem = { href: string; label: string; icon: string };

export function SidebarNav({ items }: { items: SidebarItem[] }) {
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
      })}
    </nav>
  );
}
