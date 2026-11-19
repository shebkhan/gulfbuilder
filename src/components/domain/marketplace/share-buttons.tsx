"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { shareUrls } from "@/lib/marketplace";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("marketplace.share");
  const [copied, setCopied] = useState(false);
  const links = shareUrls(url, title);

  const copy = async () => {
    await navigator.clipboard.writeText(links.copy);
    setCopied(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label-md text-label-md text-on-surface-variant">{t("label")}</span>
      <Button asChild variant="secondary" size="sm">
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">{t("whatsapp")}</a>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <a href={links.x} target="_blank" rel="noopener noreferrer">{t("x")}</a>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <a href={links.facebook} target="_blank" rel="noopener noreferrer">{t("facebook")}</a>
      </Button>
      <Button variant="secondary" size="sm" onClick={copy} type="button">
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
