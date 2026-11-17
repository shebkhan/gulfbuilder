export type PickerTenant = {
  id: string;
  full_name: string;
  id_number: string | null;
  nationality: string | null;
};

export type BuildingOption = {
  id: string;
  code: string;
  name: string;
};

export function mergeTenantGroups<T extends { id: string; full_name: string }>(
  ...groups: T[][]
): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const tenant of group) byId.set(tenant.id, tenant);
  }
  return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}
