"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBuildingAction, type PropertyState } from "@/server/actions/property";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

type Props = {
  owners: { id: string; name: string }[];
  labels: {
    code: string;
    name: string;
    owner: string;
    city: string;
    create: string;
    creating: string;
    created: string;
    errors: Record<string, string>;
  };
};

export function BuildingForm({ owners, labels }: Props) {
  const [state, formAction, pending] = useActionState<PropertyState, FormData>(
    createBuildingAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="code">{labels.code}</Label>
        <Input id="code" name="code" required dir="ltr" maxLength={40} />
      </div>
      <div>
        <Label htmlFor="name">{labels.name}</Label>
        <Input id="name" name="name" required maxLength={120} />
      </div>
      <div>
        <Label htmlFor="ownerId">{labels.owner}</Label>
        <select id="ownerId" name="ownerId" className={selectClass} required>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="city">{labels.city}</Label>
        <Input id="city" name="city" maxLength={80} />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container sm:col-span-2">
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      ) : null}

      {state.ok ? (
        <p role="status" className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container sm:col-span-2">
          {labels.created}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
        {pending ? labels.creating : labels.create}
      </Button>
    </form>
  );
}
