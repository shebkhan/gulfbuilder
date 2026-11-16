import type { Role } from "@/lib/rbac";

/** SPEC 3: TOTP MFA is mandatory for admin roles. */
export function requiresMfa(role: Role): boolean {
  return role === "org_admin" || role === "platform_admin";
}
