"use client";

import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
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
    q?: string;
    name?: string;
    email?: string;
    phone?: string;
    idNumber?: string;
    buildingId?: string;
  };
  labels: {
    search: string;
    searchPlaceholder: string;
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

  const hasAdvancedFilters = Boolean(
    currentParams.name ||
      currentParams.email ||
      currentParams.phone ||
      currentParams.idNumber ||
      (currentParams.buildingId && currentParams.buildingId !== "all"),
  );

  const [isOpen, setIsOpen] = useState(hasAdvancedFilters);
  const [q, setQ] = useState(currentParams.q ?? "");
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

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildQuery({ q, buildingId: buildingId !== "all" ? buildingId : undefined }));
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
    setQ("");
    setName("");
    setEmail("");
    setPhone("");
    setIdNumber("");
    setBuildingId("all");
    router.push(pathname);
  };

  const activeFiltersCount = [
    currentParams.q,
    currentParams.name,
    currentParams.email,
    currentParams.phone,
    currentParams.idNumber,
    currentParams.buildingId && currentParams.buildingId !== "all" ? currentParams.buildingId : null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-container-lowest p-4 shadow-sm">
      {/* Top Search bar with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleQuickSearch} className="flex flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative w-full">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="ps-9"
              aria-label={labels.search}
            />
          </div>
          <Button type="submit" variant="secondary" className="shrink-0">
            {labels.search}
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1.5"
          >
            <Filter className="size-4" />
            <span>{labels.advancedSearch}</span>
            {activeFiltersCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary font-label-sm text-xs font-semibold text-on-primary">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface"
            >
              <X className="size-4" />
              <span>{labels.clearFilters}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {isOpen && (
        <form
          onSubmit={handleAdvancedSearch}
          className="mt-2 grid grid-cols-1 gap-4 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-on-surface-variant">{labels.searchByName}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-on-surface-variant">{labels.searchByEmail}</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. tenant@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-on-surface-variant">{labels.searchByPhone}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +974..."
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-on-surface-variant">{labels.searchById}</Label>
            <Input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 28863451234"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-on-surface-variant">{labels.filterByBuilding}</Label>
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

          <div className="col-span-full flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClear}>
              {labels.clearFilters}
            </Button>
            <Button type="submit">
              {labels.applyFilters}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

