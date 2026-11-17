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
import { buildingSchema } from "@/schemas/property";
import { createBuildingAction, type PropertyState } from "@/server/actions/property";

type Values = {
  code: string;
  name: string;
  ownerId: string;
  city?: string;
};

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
    help: Record<string, string>;
    errors: Record<string, string>;
  };
};

export function BuildingForm({ owners, labels }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      code: "",
      name: "",
      ownerId: owners[0]?.id ?? "",
      city: "",
    },
  });
  const [state, dispatch, pending] = useActionState<PropertyState, FormData>(
    createBuildingAction,
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
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.code}</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" maxLength={40} />
              </FormControl>
              <FormDescription>{labels.help.code}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.name}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={120} />
              </FormControl>
              <FormDescription>{labels.help.name}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ownerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.owner}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{labels.help.owner}</FormDescription>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.city}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} maxLength={80} />
              </FormControl>
              <FormDescription>{labels.help.city}</FormDescription>
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
