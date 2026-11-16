"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/schemas/auth";

export type AuthField = {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete?: string;
};

type Props = {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  fields: AuthField[];
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel: string;
  errorMessages: Record<string, string>;
  footer?: React.ReactNode;
};

export function AuthForm({
  action,
  fields,
  hidden,
  submitLabel,
  pendingLabel,
  errorMessages,
  footer,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const message = state.error ? errorMessages[state.error] : undefined;
  const isNotice = state.error === "check_email";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      {fields.map((field) => (
        <div key={field.name}>
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            required
            autoComplete={field.autoComplete}
          />
        </div>
      ))}

      {message ? (
        <p
          role={isNotice ? "status" : "alert"}
          className={
            isNotice
              ? "rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
              : "rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          }
        >
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? pendingLabel : submitLabel}
      </Button>

      {footer}
    </form>
  );
}
