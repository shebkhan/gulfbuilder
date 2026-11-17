"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, usePathname } from "@/i18n/navigation";

interface BuildingOption {
  id: string;
  code: string;
  name: string;
}

interface TenantSearchProps {
  buildings: BuildingOption[];
  currentParams: {
    name?: string;
    email?: string;
    phone?: string;
    idNumber?: string;
    buildingId?: string;
  };
  labels: {
    advancedSearch: string;
    searchByName: string;
    searchByEmail: string;
    searchByPhone: string;
    searchById: string;
    filterByBuilding: string;
    allBuildings: string;
    clearFilters: string;
    applyFilters: string;
  };
}

export function TenantSearch({ buildings, currentParams, labels }: TenantSearchProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState(currentParams.name ?? "");
  const [email, setEmail] = useState(currentParams.email ?? "");
  const [phone, setPhone] = useState(currentParams.phone ?? "");
  const [idNumber, setIdNumber] = useState(currentParams.idNumber ?? "");
  const [buildingId, setBuildingId] = useState(currentParams.buildingId ?? "all");

  const buildQuery = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val && val.trim() && val !== "all") {
        search.set(key, val.trim());
      }
    }
    const queryString = search.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const handleAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      buildQuery({
        name,
        email,
        phone,
        idNumber,
        buildingId: buildingId !== "all" ? buildingId : undefined,
      }),
    );
  };

  const handleClear = () => {
    setName("");
    setEmail("");
    setPhone("");
    setIdNumber("");
    setBuildingId("all");
    router.push(pathname);
  };

  const activeFiltersCount = [
    currentParams.name,
    currentParams.email,
    currentParams.phone,
    currentParams.idNumber,
    currentParams.buildingId && currentParams.buildingId !== "all" ? currentParams.buildingId : null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-container-lowest p-4 shadow-sm">
      <span className="font-section-kicker text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
        {labels.advancedSearch}
      </span>
      <form
        onSubmit={handleAdvancedSearch}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-on-surface-variant">{labels.searchByName}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-on-surface-variant">{labels.searchByEmail}</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. tenant@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-on-surface-variant">{labels.searchByPhone}</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +974..."
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-on-surface-variant">{labels.searchById}</Label>
          <Input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="e.g. 28863451234"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-on-surface-variant">{labels.filterByBuilding}</Label>
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger>
              <SelectValue placeholder={labels.allBuildings} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{labels.allBuildings}</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-full flex items-center justify-between gap-2 pt-2">
          {activeFiltersCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface"
            >
              <X className="size-4" />
              <span>{labels.clearFilters}</span>
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit">{labels.applyFilters}</Button>
        </div>
      </form>
    </div>
  );
}
