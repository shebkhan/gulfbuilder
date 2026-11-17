export type PickerTenant = {
  id: string;
  full_name: string;
  phone: string | null;
};

export type BuildingOption = {
  id: string;
  code: string;
  name: string;
};

export function mergeTenantGroups(...groups: PickerTenant[][]): PickerTenant[] {
  const byId = new Map<string, PickerTenant>();
  for (const group of groups) {
    for (const tenant of group) byId.set(tenant.id, tenant);
  }
  return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}
