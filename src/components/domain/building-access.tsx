"use client";

import { useActionState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import {
  grantBuildingAccessAction,
  revokeBuildingAccessAction,
  type PropertyState,
} from "@/server/actions/property";

const grantAccessSchema = z.object({
  buildingId: z.string().uuid("validation.invalidUuid"),
  userId: z.string().uuid("validation.invalidUuid"),
});

type GrantValues = z.infer<typeof grantAccessSchema>;

type Props = {
  buildingId: string;
  staff: { id: string; name: string }[];
  access: { userId: string; name: string }[];
  labels: {
    staff: string;
    grant: string;
    revoke: string;
    noStaff: string;
    help: Record<string, string>;
    errors: Record<string, string>;
  };
};

export function BuildingAccess({
  buildingId,
  staff,
  access,
  labels,
}: Props) {
  const assigned = new Set(access.map((entry) => entry.userId));
  const available = staff.filter((member) => !assigned.has(member.id));

  const form = useForm<GrantValues>({
    resolver: zodResolver(grantAccessSchema),
    defaultValues: { buildingId, userId: available[0]?.id ?? "" },
  });
  const [state, dispatch, pending] = useActionState<PropertyState, FormData>(
    grantBuildingAccessAction,
    {},
  );

  // Revalidation removes the just-granted user; keep the select on a still-available one.
  useEffect(() => {
    if (!available.some((member) => member.id === form.getValues("userId"))) {
      form.setValue("userId", available[0]?.id ?? "", { shouldValidate: true });
    }
  }, [available, form]);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {access.length === 0 ? (
          <li className="font-body-sm text-body-sm text-on-surface-variant">{labels.noStaff}</li>
        ) : (
          access.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface-container-low py-1 pe-1 ps-3 font-label-md text-label-md"
            >
              {entry.name}
              <form action={revokeBuildingAccessAction}>
                <input type="hidden" name="buildingId" value={buildingId} />
                <input type="hidden" name="userId" value={entry.userId} />
                <button
                  type="submit"
                  aria-label={`${labels.revoke} ${entry.name}`}
                  className="rounded-full px-2 py-1 font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  ×
                </button>
              </form>
            </li>
          ))
        )}
      </ul>

      {available.length > 0 ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>{labels.staff}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {available.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{labels.help.staff}</FormDescription>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              {labels.grant}
            </Button>
          </form>
        </Form>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      ) : null}
    </div>
  );
}
