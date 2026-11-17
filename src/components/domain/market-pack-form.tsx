"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMarketPackAction, type PlatformState } from "@/server/actions/platform";

export type MarketPackOption = {
  countryCode: string;
  effectiveFrom: string;
  version: number;
  rules: unknown;
};

export function MarketPackForm({ initial }: { initial?: MarketPackOption }) {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(updateMarketPackAction, {});

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`country-${initial?.countryCode ?? "new"}`}>{t("marketPack.country")}</Label>
          <Input
            id={`country-${initial?.countryCode ?? "new"}`}
            name="countryCode"
            defaultValue={initial?.countryCode ?? ""}
            maxLength={2}
            placeholder="QA"
            dir="ltr"
            required
          />
        </div>
        <div>
          <Label htmlFor={`from-${initial?.countryCode ?? "new"}`}>{t("marketPack.effectiveFrom")}</Label>
          <Input
            id={`from-${initial?.countryCode ?? "new"}`}
            name="effectiveFrom"
            type="date"
            defaultValue={initial?.effectiveFrom?.slice(0, 10) ?? ""}
            required
          />
        </div>
        <div>
          <Label htmlFor={`version-${initial?.countryCode ?? "new"}`}>{t("marketPack.version")}</Label>
          <Input
            id={`version-${initial?.countryCode ?? "new"}`}
            name="version"
            type="number"
            min={1}
            defaultValue={initial?.version ?? 1}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`rules-${initial?.countryCode ?? "new"}`}>{t("marketPack.rules")}</Label>
        <Textarea
          id={`rules-${initial?.countryCode ?? "new"}`}
          name="rules"
          rows={6}
          dir="ltr"
          defaultValue={JSON.stringify(initial?.rules ?? {}, null, 2)}
          className="font-mono"
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="font-body-sm text-body-sm text-secondary">
          {t("marketPack.saved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}
