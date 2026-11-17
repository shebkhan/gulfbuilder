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
import { meterSchema, readingSchema } from "@/schemas/meters";
import { addMeterReadingAction, createMeterAction, type MeterState } from "@/server/actions/meters";

type MeterValues = {
  kind: "electricity" | "water" | "gas";
  buildingId: string;
  meterNo?: string;
};

type ReadingValues = {
  meterId: string;
  readOn: string;
  value: string;
};

export function MeterForms({
  buildings,
  meters,
}: {
  buildings: { id: string; label: string }[];
  meters: { id: string; label: string }[];
}) {
  const t = useTranslations("meters");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;

  const meterForm = useForm<MeterValues>({
    resolver: zodResolver(meterSchema),
    defaultValues: { kind: "electricity", buildingId: "", meterNo: "" },
  });

  const [meterState, meterDispatch, meterPending] = useActionState<MeterState, FormData>(
    async (prev, formData) => {
      const res = await createMeterAction(prev, formData);
      if (res.ok) meterForm.reset();
      return res;
    },
    {},
  );

  const readingForm = useForm<ReadingValues>({
    resolver: zodResolver(readingSchema),
    defaultValues: { meterId: "", readOn: "", value: "" },
  });

  const [readingState, readingDispatch, readingPending] = useActionState<MeterState, FormData>(
    async (prev, formData) => {
      const res = await addMeterReadingAction(prev, formData);
      if (res.ok) readingForm.reset();
      return res;
    },
    {},
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Form {...meterForm}>
        <form
          onSubmit={meterForm.handleSubmit((values) => meterDispatch(toFormData(values)))}
          noValidate
          className="flex max-w-xl flex-col gap-4"
        >
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newMeter")}</h2>

          <FormField
            control={meterForm.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.kind}>{t("kind")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["electricity", "water", "gas"] as const).map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`kinds.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={meterForm.control}
            name="buildingId"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.building}>{t("building")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectBuilding")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={meterForm.control}
            name="meterNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.meterNo}>{t("meterNo")}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} maxLength={60} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          {meterState.error ? (
            <p
              role="alert"
              className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
            >
              {errors[meterState.error] ?? meterState.error}
            </p>
          ) : null}
          {meterState.ok ? (
            <p
              role="status"
              className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
            >
              {t("created")}
            </p>
          ) : null}

          <Button type="submit" disabled={meterPending} className="self-start">
            {meterPending ? t("saving") : t("create")}
          </Button>
        </form>
      </Form>

      <Form {...readingForm}>
        <form
          onSubmit={readingForm.handleSubmit((values) => readingDispatch(toFormData(values)))}
          noValidate
          className="flex max-w-xl flex-col gap-4"
        >
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newReading")}</h2>

          <FormField
            control={readingForm.control}
            name="meterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.meter}>{t("meter")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectMeter")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {meters.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={readingForm.control}
            name="readOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.readOn}>{t("readOn")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={readingForm.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.value}>{t("value")}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" min="0" {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          {readingState.error ? (
            <p
              role="alert"
              className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
            >
              {errors[readingState.error] ?? readingState.error}
            </p>
          ) : null}
          {readingState.ok ? (
            <p
              role="status"
              className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
            >
              {t("recorded")}
            </p>
          ) : null}

          <Button type="submit" disabled={readingPending} className="self-start">
            {readingPending ? t("saving") : t("record")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
