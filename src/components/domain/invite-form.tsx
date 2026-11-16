"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMemberAction, type InviteState } from "@/server/actions/members";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

type Props = {
  locale: string;
  labels: {
    email: string;
    role: string;
    invite: string;
    sending: string;
    invited: string;
    errors: Record<string, string>;
  };
  roles: { value: string; label: string }[];
};

export function InviteForm({ locale, labels, roles }: Props) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMemberAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="off" />
      </div>

      <div>
        <Label htmlFor="role">{labels.role}</Label>
        <select id="role" name="role" defaultValue="manager" className={selectClass} required>
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {labels.errors[state.error] ?? labels.errors.invite_failed}
        </p>
      ) : null}

      {state.invited ? (
        <p role="status" className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
          {labels.invited.replace("{email}", state.invited)}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 self-start">
        {pending ? labels.sending : labels.invite}
      </Button>
    </form>
  );
}
