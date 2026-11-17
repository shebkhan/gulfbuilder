"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeTenantGroups, type BuildingOption, type PickerTenant } from "@/lib/tenant-picker";
import { getTenantsForBuilding } from "@/server/actions/tenants";

type InitialTenant = PickerTenant & { buildingId: string };

type Props = {
  buildings: BuildingOption[];
  value: string;
  initialTenant?: InitialTenant | null;
  onChange: (tenantId: string, tenant: PickerTenant | null) => void;
};

export function BuildingTenantPicker({ buildings, value, initialTenant, onChange }: Props) {
  const t = useTranslations("tenantPicker");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [buildingId, setBuildingId] = useState(initialTenant?.buildingId ?? "");
  const [tenants, setTenants] = useState<PickerTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const selected =
    tenants.find((tenant) => tenant.id === value) ??
    (initialTenant?.id === value ? initialTenant : null);

  const loadTenants = useCallback(async (building: string, seed: PickerTenant[] = []) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const loaded = await getTenantsForBuilding(building);
      if (id === requestId.current) setTenants(mergeTenantGroups(seed, loaded));
    } catch {
      if (id === requestId.current) {
        setTenants(seed);
        setError(true);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // A deep link starts with a building and one tenant; load that building's list on mount.
  useEffect(() => {
    if (initialTenant?.buildingId) void loadTenants(initialTenant.buildingId, [initialTenant]);
  }, [initialTenant, loadTenants]);

  const handleBuildingChange = (next: string) => {
    requestId.current++;
    setBuildingId(next);
    setError(false);
    setLoading(false);
    onChange("", null);
    if (!next) {
      setTenants([]);
      return;
    }
    void loadTenants(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Input
          readOnly
          value={selected?.full_name ?? ""}
          placeholder={t("selectTenant")}
          aria-label={t("tenant")}
          className="cursor-pointer pe-9"
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
      </div>

      <DialogContent className="max-w-[36rem]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-500">{t("building")}</Label>
            <Select value={buildingId} onValueChange={handleBuildingChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectBuilding")} />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.code} — {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!buildingId ? (
            <p className="py-6 text-center font-body-sm text-body-sm text-zinc-500">
              {t("chooseBuilding")}
            </p>
          ) : loading ? (
            <p className="py-6 text-center font-body-sm text-body-sm text-zinc-500">
              {tCommon("loading")}
            </p>
          ) : error ? (
            <p role="alert" className="py-6 text-center font-body-sm text-body-sm text-red-600">
              {t("error")}
            </p>
          ) : tenants.length === 0 ? (
            <p className="py-6 text-center font-body-sm text-body-sm text-zinc-500">
              {t("empty")}
            </p>
          ) : (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-200 p-1">
              {tenants.map((tenant) => (
                <button
                  type="button"
                  key={tenant.id}
                  onClick={() => {
                    onChange(tenant.id, tenant);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-start transition-colors hover:bg-zinc-100"
                >
                  <span className="font-medium text-zinc-900">{tenant.full_name}</span>
                  <span className="flex items-center gap-2 text-sm text-zinc-500">
                    {tenant.id_number ? <span dir="ltr">{tenant.id_number}</span> : null}
                    {tenant.nationality ? <span>{tenant.nationality}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
