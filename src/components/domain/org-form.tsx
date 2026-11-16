"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationAction } from "@/server/actions/auth";
import type { OrgState } from "@/schemas/auth";

type Props = {
  locale: string;
  pendingLabel: string;
  labels: { orgName: string; slug: string; market: string; currency: string; create: string };
  markets: { value: string; label: string }[];
  currencies: string[];
};

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

export function OrgForm({ locale, pendingLabel, labels, markets, currencies }: Props) {
  const [state, formAction, pending] = useActionState<OrgState, FormData>(
    createOrganizationAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="uiLocale" value={locale} />

      <div>
        <Label htmlFor="name">{labels.orgName}</Label>
        <Input id="name" name="name" required autoComplete="organization" />
      </div>

      <div>
        <Label htmlFor="slug">{labels.slug}</Label>
        <Input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])"
          placeholder="doha-towers"
          dir="ltr"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="countryCode">{labels.market}</Label>
          <select
            id="countryCode"
            name="countryCode"
            defaultValue="QA"
            className={selectClass}
            required
          >
            {markets.map((market) => (
              <option key={market.value} value={market.value}>
                {market.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="baseCurrency">{labels.currency}</Label>
          <select
            id="baseCurrency"
            name="baseCurrency"
            defaultValue="QAR"
            className={selectClass}
            required
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? pendingLabel : labels.create}
      </Button>
    </form>
  );
}
