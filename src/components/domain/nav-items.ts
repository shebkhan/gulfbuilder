import {
  Banknote,
  BarChart3,
  Building2,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { can, type Capability, type Role } from "@/lib/rbac";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  capability: Capability;
};

/** Order follows the SPEC repository layout route groups. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, capability: "reports.read" },
  { href: "/buildings", labelKey: "properties", icon: Building2, capability: "properties.read" },
  { href: "/tenants", labelKey: "tenants", icon: Users, capability: "properties.read" },
  { href: "/leases", labelKey: "leases", icon: FileSignature, capability: "leases.write" },
  { href: "/payments", labelKey: "payments", icon: CreditCard, capability: "finance.read" },
  { href: "/cheques", labelKey: "cheques", icon: Banknote, capability: "finance.read" },
  { href: "/deposits", labelKey: "deposits", icon: PiggyBank, capability: "finance.read" },
  { href: "/expenses", labelKey: "expenses", icon: Receipt, capability: "expenses.write" },
  { href: "/maintenance", labelKey: "maintenance", icon: Wrench, capability: "maintenance.write" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, capability: "reports.read" },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings, capability: "settings.write" },
];

export function visibleNav(role: Role | null, items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => can(role, item.capability));
}
