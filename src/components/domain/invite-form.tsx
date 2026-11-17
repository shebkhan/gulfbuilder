"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import { inviteSchema } from "@/schemas/members";
import { inviteMemberAction, type InviteState } from "@/server/actions/members";

type Values = {
  email: string;
  role: "manager" | "accountant" | "caretaker" | "owner" | "tenant";
  locale: "en" | "ar";
};

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
  const t = useTranslations("settings.users");

  const form = useForm<Values>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "manager", locale: locale as Values["locale"] },
  });

  const [state, dispatch, pending] = useActionState<InviteState, FormData>(inviteMemberAction, {});

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.email}</FormLabel>
              <FormControl>
                <Input {...field} type="email" autoComplete="off" />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={t("roleHint")}>{labels.role}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {labels.errors[state.error] ?? labels.errors.invite_failed}
          </p>
        ) : null}

        {state.invited ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {labels.invited.replace("{email}", state.invited)}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 self-start">
          {pending ? labels.sending : labels.invite}
        </Button>
      </form>
    </Form>
  );
}
