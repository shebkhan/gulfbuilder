"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenantAction, type TenantState } from "@/server/actions/tenants";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

type Props = {
  labels: {
    fullName: string;
    kind: string;
    person: string;
    company: string;
    language: string;
    arabic: string;
    english: string;
    idNumber: string;
    idNumberPlaceholder: string;
    phone: string;
    whatsapp: string;
    email: string;
    nationality: string;
    employer: string;
    create: string;
    creating: string;
    created: string;
    errors: Record<string, string>;
  };
};

export function TenantForm({ labels }: Props) {
  const [state, formAction, pending] = useActionState<TenantState, FormData>(
    createTenantAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="fullName">{labels.fullName}</Label>
        <Input id="fullName" name="fullName" required maxLength={120} />
      </div>

      <div>
        <Label htmlFor="kind">{labels.kind}</Label>
        <select id="kind" name="kind" className={selectClass} defaultValue="person">
          <option value="person">{labels.person}</option>
          <option value="company">{labels.company}</option>
        </select>
      </div>

      <div>
        <Label htmlFor="language">{labels.language}</Label>
        <select id="language" name="language" className={selectClass} defaultValue="ar">
          <option value="ar">{labels.arabic}</option>
          <option value="en">{labels.english}</option>
        </select>
      </div>

      <div>
        <Label htmlFor="idNumber">{labels.idNumber}</Label>
        <Input
          id="idNumber"
          name="idNumber"
          dir="ltr"
          placeholder={labels.idNumberPlaceholder}
          maxLength={30}
        />
      </div>

      <div>
        <Label htmlFor="nationality">{labels.nationality}</Label>
        <Input id="nationality" name="nationality" maxLength={60} />
      </div>

      <div>
        <Label htmlFor="phone">{labels.phone}</Label>
        <Input id="phone" name="phone" type="tel" dir="ltr" maxLength={30} />
      </div>

      <div>
        <Label htmlFor="whatsapp">{labels.whatsapp}</Label>
        <Input id="whatsapp" name="whatsapp" type="tel" dir="ltr" maxLength={30} />
      </div>

      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" dir="ltr" maxLength={80} />
      </div>

      <div>
        <Label htmlFor="employer">{labels.employer}</Label>
        <Input id="employer" name="employer" maxLength={120} />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container sm:col-span-2"
        >
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container sm:col-span-2"
        >
          {labels.created}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
        {pending ? labels.creating : labels.create}
      </Button>
    </form>
  );
}

