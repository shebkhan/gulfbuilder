/**
 * Capability matrix from SPEC section 4. Keep this the single source of truth:
 * the database policies and the navigation both key off the same role names.
 */
export const ROLES = [
  "platform_admin",
  "org_admin",
  "manager",
  "accountant",
  "caretaker",
  "owner",
  "tenant",
] as const;

export type Role = (typeof ROLES)[number];

type Capability =
  | "properties.read"
  | "properties.write"
  | "tenants.write"
  | "leases.write"
  | "leases.approve"
  | "finance.read"
  | "finance.write"
  | "cheques.approve"
  | "deposits.approve"
  | "expenses.write"
  | "expenses.approve"
  | "maintenance.write"
  | "ledger.write"
  | "ledger.close"
  | "reports.read"
  | "statements.write"
  | "settings.write"
  | "dailyTasks.read"
  | "platform.admin";

const MATRIX: Record<Capability, readonly Role[]> = {
  "properties.read": ["org_admin", "manager", "accountant", "caretaker", "owner"],
  "properties.write": ["org_admin", "manager"],
  "tenants.write": ["org_admin", "manager"],
  "leases.write": ["org_admin", "manager"],
  "leases.approve": ["org_admin"],
  "finance.read": ["org_admin", "manager", "accountant", "owner"],
  "finance.write": ["org_admin", "accountant"],
  "cheques.approve": ["org_admin", "accountant"],
  "deposits.approve": ["org_admin", "accountant"],
  "expenses.write": ["org_admin", "manager", "accountant", "caretaker"],
  "expenses.approve": ["org_admin", "accountant", "owner"],
  "maintenance.write": ["org_admin", "manager", "caretaker"],
  "ledger.write": ["org_admin", "accountant"],
  "ledger.close": ["org_admin", "accountant"],
  "reports.read": ["org_admin", "manager", "accountant", "owner"],
  "statements.write": ["org_admin", "accountant"],
  "settings.write": ["org_admin"],
  "dailyTasks.read": ["manager", "caretaker"],
  "platform.admin": ["platform_admin"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[capability].includes(role);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export type { Capability };
