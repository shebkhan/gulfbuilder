"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Subscribes to Postgres changes on `table` and refreshes the route when any
 * row changes. Keeps screens (inbox, maintenance, payments) live without polling.
 */
export function RealtimeRefresh({ table, filter }: { table: string; filter?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`rt:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, router]);
  return null;
}