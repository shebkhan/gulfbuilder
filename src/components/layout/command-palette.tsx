"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchAction, type SearchResult } from "@/server/actions/search";

export function CommandPalette() {
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(
    (q: string) => {
      setQuery(q);
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      startTransition(async () => {
        const { results } = await searchAction(q);
        setResults(results);
      });
    },
    [],
  );

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{t("search" as never) || "Search"}</span>
        <kbd className="ml-1 hidden rounded bg-surface-container px-1.5 py-0.5 font-label-sm text-label-sm sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Input
            autoFocus
            value={query}
            onChange={(e) => run(e.target.value)}
            placeholder={t("search" as never) || "Search tenants, units, leases…"}
          />
          <div className="mt-3 max-h-80 overflow-y-auto" aria-live="polite" aria-atomic="true">
            {pending ? (
              <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
                {t("loading")}
              </p>
            ) : results.length === 0 ? (
              <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
                {query.trim().length < 2 ? "Type at least 2 characters" : "No results"}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {results.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className="flex w-full flex-col items-start gap-0.5 px-2 py-2 text-start hover:bg-surface-container-low"
                    >
                      <span className="font-body-md text-body-md font-medium text-on-surface">
                        {r.title}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {r.type}
                        {r.subtitle ? ` · ${r.subtitle}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}