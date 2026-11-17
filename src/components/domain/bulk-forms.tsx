"use client";

import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
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
import { floorsSchema, unitsSchema } from "@/schemas/property";
import {
  generateFloorsAction,
  generateUnitsAction,
  type PropertyState,
} from "@/server/actions/property";

type FloorValues = z.infer<typeof floorsSchema>;
type UnitValues = z.infer<typeof unitsSchema>;

type Labels = {
  bulkFloors: string;
  bulkUnits: string;
  from: string;
  to: string;
  prefix: string;
  start: string;
  count: string;
  pad: string;
  floor: string;
  type: string;
  area: string;
  rent: string;
  generate: string;
  generating: string;
  result: string;
  help: Record<string, string>;
  errors: Record<string, string>;
};

function Result({ state, labels }: { state: PropertyState; labels: Labels }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
      >
        {labels.errors[state.error] ?? labels.errors.failed}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p
        role="status"
        className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
      >
        {labels.result.replace("{count}", state.ok)}
      </p>
    );
  }
  return null;
}

export function FloorsForm({ buildingId, labels }: { buildingId: string; labels: Labels }) {
  const form = useForm<FloorValues>({
    resolver: zodResolver(floorsSchema),
    defaultValues: { buildingId, from: 0, to: 4 },
  });
  const [state, dispatch, pending] = useActionState<PropertyState, FormData>(
    generateFloorsAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.bulkFloors}</CardTitle>
      </CardHeader>
      <CardBody>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
            noValidate
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-6">
              <FormField
                control={form.control}
                name="from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.from}>{labels.from}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.to}>{labels.to}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Result state={state} labels={labels} />
            <Button type="submit" disabled={pending} className="self-start" variant="secondary">
              {pending ? labels.generating : labels.generate}
            </Button>
          </form>
        </Form>
      </CardBody>
    </Card>
  );
}

export function UnitsForm({
  floors,
  labels,
}: {
  floors: { id: string; level: number; label: string | null }[];
  labels: Labels;
}) {
  const form = useForm<UnitValues>({
    resolver: zodResolver(unitsSchema),
    defaultValues: {
      floorId: floors[0]?.id ?? "",
      prefix: "",
      start: 1,
      count: 4,
      pad: 2,
      unitType: "",
      areaSqm: "",
      rent: "",
    },
  });
  const [state, dispatch, pending] = useActionState<PropertyState, FormData>(
    generateUnitsAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.bulkUnits}</CardTitle>
      </CardHeader>
      <CardBody>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
            noValidate
            className="flex flex-col gap-6"
          >
            <FormField
              control={form.control}
              name="floorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{labels.floor}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {floors.map((floor) => (
                        <SelectItem key={floor.id} value={floor.id}>
                          {floor.label ?? floor.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-6">
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.prefix}>{labels.prefix}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} dir="ltr" maxLength={10} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.count}>{labels.count}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.start}>{labels.start}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.pad}>{labels.pad}</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.unitType}>{labels.type}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} dir="ltr" maxLength={30} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="areaSqm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={labels.help.areaSqm}>{labels.area}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="rent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel description={labels.help.rent}>{labels.rent}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} inputMode="decimal" dir="ltr" />
                  </FormControl>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />
            <Result state={state} labels={labels} />
            <Button type="submit" disabled={pending} className="self-start" variant="secondary">
              {pending ? labels.generating : labels.generate}
            </Button>
          </form>
        </Form>
      </CardBody>
    </Card>
  );
}
