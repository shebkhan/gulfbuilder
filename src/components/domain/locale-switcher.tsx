"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Segmented EN / العربية control, mirroring the mockup header. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-surface-container-low p-1 font-label-sm text-label-sm",
        isPending && "opacity-60",
      )}
    >
      {routing.locales.map((option) => (
        <Button
          key={option}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => switchTo(option)}
          aria-current={option === locale ? "true" : undefined}
          className={cn(
            "h-auto px-2 py-0.5 font-label-sm",
            option === locale
              ? "bg-surface-container-lowest font-medium text-on-surface shadow-sm"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {option === "en" ? "EN" : "العربية"}
        </Button>
      ))}
    </div>
  );
}
