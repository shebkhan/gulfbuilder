"use client";

import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import { tenantSchema } from "@/schemas/tenants";
import { createTenantAction, type TenantState } from "@/server/actions/tenants";

type Values = {
  fullName: string;
  kind: "person" | "company";
  language: "ar" | "en";
  idNumber?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  nationality?: string;
  employer?: string;
};

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
    help: Record<string, string>;
    errors: Record<string, string>;
  };
};

export function TenantForm({ labels }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      fullName: "",
      kind: "person",
      language: "ar",
      idNumber: "",
      phone: "",
      whatsapp: "",
      email: "",
      nationality: "",
      employer: "",
    },
  });
  const [state, dispatch, pending] = useActionState<TenantState, FormData>(
    createTenantAction,
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{labels.fullName}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={120} />
              </FormControl>
              <FormDescription>{labels.help.fullName}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.kind}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="person">{labels.person}</SelectItem>
                  <SelectItem value="company">{labels.company}</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>{labels.help.kind}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.language}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ar">{labels.arabic}</SelectItem>
                  <SelectItem value="en">{labels.english}</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>{labels.help.language}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="idNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.idNumber}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} dir="ltr" placeholder={labels.idNumberPlaceholder} maxLength={30} />
              </FormControl>
              <FormDescription>{labels.help.idNumber}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nationality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.nationality}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} maxLength={60} />
              </FormControl>
              <FormDescription>{labels.help.nationality}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.phone}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} type="tel" dir="ltr" maxLength={30} />
              </FormControl>
              <FormDescription>{labels.help.phone}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.whatsapp}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} type="tel" dir="ltr" maxLength={30} />
              </FormControl>
              <FormDescription>{labels.help.whatsapp}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.email}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} type="email" dir="ltr" maxLength={80} />
              </FormControl>
              <FormDescription>{labels.help.email}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="employer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.employer}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} maxLength={120} />
              </FormControl>
              <FormDescription>{labels.help.employer}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

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
    </Form>
  );
}
