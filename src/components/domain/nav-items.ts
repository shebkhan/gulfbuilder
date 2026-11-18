import {
  Banknote,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  Gauge,
  LayoutDashboard,
  Palette,
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
  { href: "/today", labelKey: "today", icon: ClipboardList, capability: "dailyTasks.read" },
  { href: "/buildings", labelKey: "properties", icon: Building2, capability: "properties.read" },
  { href: "/tenants", labelKey: "tenants", icon: Users, capability: "properties.read" },
  { href: "/leases", labelKey: "leases", icon: FileSignature, capability: "leases.write" },
  { href: "/payments", labelKey: "payments", icon: CreditCard, capability: "finance.read" },
  { href: "/cheques", labelKey: "cheques", icon: Banknote, capability: "finance.read" },
  { href: "/deposits", labelKey: "deposits", icon: PiggyBank, capability: "finance.read" },
  { href: "/expenses", labelKey: "expenses", icon: Receipt, capability: "expenses.write" },
  { href: "/maintenance", labelKey: "maintenance", icon: Wrench, capability: "maintenance.write" },
  {
    href: "/inspections",
    labelKey: "inspections",
    icon: ClipboardCheck,
    capability: "maintenance.write",
  },
  { href: "/reports", labelKey: "reports", icon: BarChart3, capability: "reports.read" },
  { href: "/documents", labelKey: "documents", icon: FileText, capability: "properties.read" },
  { href: "/meters", labelKey: "meters", icon: Gauge, capability: "maintenance.write" },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings, capability: "settings.write" },
];

/** Owner portal (SPEC §8 O1): read-only views of the owner's own buildings. */
export const OWNER_NAV: NavItem[] = [
  { href: "/owner", labelKey: "dashboard", icon: LayoutDashboard, capability: "reports.read" },
  { href: "/owner/buildings", labelKey: "buildings", icon: Building2, capability: "reports.read" },
  {
    href: "/owner/rent-roll",
    labelKey: "rentRoll",
    icon: FileSignature,
    capability: "reports.read",
  },
  {
    href: "/owner/receivables",
    labelKey: "receivables",
    icon: CreditCard,
    capability: "reports.read",
  },
  { href: "/owner/reports", labelKey: "reports", icon: BarChart3, capability: "reports.read" },
  { href: "/owner/statements", labelKey: "statements", icon: Receipt, capability: "reports.read" },
  { href: "/owner/payouts", labelKey: "payouts", icon: Banknote, capability: "reports.read" },
  {
    href: "/owner/approvals",
    labelKey: "approvals",
    icon: ClipboardCheck,
    capability: "reports.read",
  },
  { href: "/owner/documents", labelKey: "documents", icon: FileText, capability: "reports.read" },
];

/** Platform console (SPEC §8): super-admin only, no organization membership required. */
export const PLATFORM_NAV: NavItem[] = [
  { href: "/platform", labelKey: "platform", icon: LayoutDashboard, capability: "platform.admin" },
  {
    href: "/platform/market-packs",
    labelKey: "marketPacks",
    icon: FileText,
    capability: "platform.admin",
  },
  { href: "/platform/themes", labelKey: "themes", icon: Palette, capability: "platform.admin" },
];

export function visibleNav(role: Role | null, items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => can(role, item.capability));
}
