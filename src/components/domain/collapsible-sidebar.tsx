"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav, type SidebarItem } from "./sidebar-nav";

const STORAGE_KEY = "gulf.sidebar.collapsed";

type Props = {
  orgName: string;
  tagline: string;
  nav: SidebarItem[];
  footer: SidebarItem[];
  collapseLabel: string;
  expandLabel: string;
};

export function CollapsibleSidebar({
  orgName,
  tagline,
  nav,
  footer,
  collapseLabel,
  expandLabel,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Read after mount so the server and first client render agree (both expanded).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, String(!prev));
      return !prev;
    });
  }

  const toggleLabel = collapsed ? expandLabel : collapseLabel;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col justify-between border-e border-surface-container-high bg-[#fefefe] py-6 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 px-2" : "w-[210px] px-3",
      )}
    >
      <div className="flex flex-col gap-6">
        {collapsed ? null : (
          <div className="flex flex-col px-3 pb-2">
            <span className="truncate font-headline-sm text-label-md leading-tight font-semibold tracking-tight text-on-surface">
              {orgName}
            </span>
            <span className="font-section-kicker text-[9px] uppercase tracking-widest text-on-surface-variant">
              {tagline}
            </span>
          </div>
        )}
        <SidebarNav items={nav} compact={collapsed} />
      </div>

      <div className="flex flex-col gap-2">
        {footer.length > 0 ? <SidebarNav items={footer} compact={collapsed} /> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className={cn("w-full", collapsed && "justify-center")}
        >
          {collapsed ? (
            <PanelLeftOpen className="rtl:rotate-180" aria-hidden />
          ) : (
            <PanelLeftClose className="rtl:rotate-180" aria-hidden />
          )}
        </Button>
      </div>
    </aside>
  );
}
