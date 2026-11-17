import { FOOTER_NAV, NAV_ITEMS, visibleNav } from "@/components/domain/nav-items";
import type { Role } from "@/lib/rbac";

export type RelatedSection =
  | "dashboard"
  | "buildings"
  | "tenants"
  | "leases"
  | "payments"
  | "cheques"
  | "deposits"
  | "expenses"
  | "maintenance"
  | "inspections"
  | "meters"
  | "reports"
  | "documents"
  | "settings";

export const RELATED_SECTIONS: Record<RelatedSection, readonly string[]> = {
  dashboard: ["/buildings", "/leases", "/reports"],
  buildings: ["/tenants", "/leases", "/documents", "/reports"],
  tenants: ["/buildings", "/leases", "/payments"],
  leases: ["/tenants", "/buildings", "/payments", "/cheques", "/reports"],
  payments: ["/leases", "/cheques", "/reports"],
  cheques: ["/leases", "/payments", "/reports"],
  deposits: ["/leases", "/payments", "/reports"],
  expenses: ["/buildings", "/payments", "/reports"],
  maintenance: ["/buildings", "/meters", "/inspections"],
  inspections: ["/buildings", "/maintenance"],
  meters: ["/buildings", "/maintenance"],
  reports: ["/payments", "/leases", "/expenses"],
  documents: ["/buildings", "/tenants", "/leases"],
  settings: ["/dashboard", "/documents"],
};

export function relatedHrefs(section: RelatedSection, role: Role): string[] {
  const allowed = new Set(visibleNav(role, [...NAV_ITEMS, ...FOOTER_NAV]).map((item) => item.href));
  return RELATED_SECTIONS[section].filter((href) => allowed.has(href));
}
