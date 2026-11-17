"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export type PrintLine = { label: string; detail?: string; value?: string };
export type PrintTotal = { label: string; value: string; emphasis?: boolean };

export function PrintLocaleLink({ href, locale }: { href: string; locale: string }) {
  const t = useTranslations("print");
  return (
    <Link href={href} locale={locale} className="font-body-sm text-body-sm text-primary underline">
      {t("otherLanguage")}
    </Link>
  );
}

/** A4 sheet shared by every printable document (SPEC §8 A2). */
export function PrintDocument({
  title,
  orgName,
  lines,
  totals,
  footer,
}: {
  title: string;
  orgName: string;
  lines: PrintLine[];
  totals: PrintTotal[];
  footer: string;
}) {
  const t = useTranslations("print");

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print-no-print flex items-center gap-3 self-stretch">
        <Button type="button" onClick={() => window.print()} className="ms-auto">
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </div>

      <article className="print-sheet w-full max-w-[210mm] border border-black/20 bg-white p-10 text-black shadow-sm">
        <header className="flex flex-col gap-1 border-b border-black/25 pb-4">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm">{orgName}</p>
        </header>

        <dl className="mt-6 flex flex-col gap-2 text-sm">
          {lines.map((line, index) => (
            <div key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-4 border-b border-black/10 pb-1">
              <dt>
                {line.label}
                {line.detail ? <span className="ms-2 text-black/60">{line.detail}</span> : null}
              </dt>
              {line.value ? <dd className="shrink-0 text-end">{line.value}</dd> : null}
            </div>
          ))}
        </dl>

        {totals.length > 0 ? (
          <div className="mt-6 flex flex-col gap-2 border-t-2 border-black/40 pt-4 text-sm">
            {totals.map((total) => (
              <div
                key={total.label}
                className={`flex items-center justify-between gap-4 ${total.emphasis ? "text-lg font-semibold" : ""}`}
              >
                <span>{total.label}</span>
                <span className="text-end">{total.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <footer className="mt-12 border-t border-black/20 pt-4 text-xs text-black/60">{footer}</footer>
      </article>
    </div>
  );
}
