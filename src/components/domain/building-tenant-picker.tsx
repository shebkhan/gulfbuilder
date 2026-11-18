"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
        <DialogTrigger asChild>
          <Input
            readOnly
            value={selected?.full_name ?? ""}
            placeholder={t("selectTenant")}
            aria-label={t("tenant")}
            className="cursor-pointer pe-9"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
              }
            }}
          />
        </DialogTrigger>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
      </div>

      <DialogContent className="sm:max-w-[36rem]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t("building")}</Label>
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
            <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              {t("chooseBuilding")}
            </p>
          ) : loading ? (
            <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              {tCommon("loading")}
            </p>
          ) : error ? (
            <p role="alert" className="py-6 text-center font-body-sm text-body-sm text-error">
              {t("error")}
            </p>
          ) : tenants.length === 0 ? (
            <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              {t("empty")}
            </p>
          ) : (
            <Card className="grid max-h-72 gap-1 overflow-y-auto p-1">
              {tenants.map((tenant) => (
                <Button
                  type="button"
                  key={tenant.id}
                  variant="ghost"
                  onClick={() => {
                    onChange(tenant.id, tenant);
                    setOpen(false);
                  }}
                  className="h-auto justify-between gap-3 rounded-lg px-3 py-2 text-start"
                >
                  <span className="font-medium text-on-surface">{tenant.full_name}</span>
                  <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                    {tenant.id_number ? <span dir="ltr">{tenant.id_number}</span> : null}
                    {tenant.nationality ? (
                      <Badge variant="neutral">{tenant.nationality}</Badge>
                    ) : null}
                  </span>
                </Button>
              ))}
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
