"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMeterReadingAction, createMeterAction, type MeterState } from "@/server/actions/meters";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed";

export function MeterForms({
  buildings,
  meters,
}: {
  buildings: { id: string; label: string }[];
  meters: { id: string; label: string }[];
}) {
  const t = useTranslations("meters");
  const [meterState, meterAction, meterPending] = useActionState<MeterState, FormData>(
    createMeterAction,
    {},
  );
  const [readingState, readingAction, readingPending] = useActionState<MeterState, FormData>(
    addMeterReadingAction,
    {},
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form action={meterAction} className="flex max-w-xl flex-col gap-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newMeter")}</h2>

        <div>
          <Label htmlFor="kind">{t("kind")}</Label>
          <select id="kind" name="kind" defaultValue="electricity" className={selectClass}>
            <option value="electricity">{t("kinds.electricity")}</option>
            <option value="water">{t("kinds.water")}</option>
            <option value="gas">{t("kinds.gas")}</option>
          </select>
        </div>

        <div>
          <Label htmlFor="buildingId">{t("building")}</Label>
          <select id="buildingId" name="buildingId" className={selectClass} required>
            <option value="">{t("selectBuilding")}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="meterNo">{t("meterNo")}</Label>
          <Input id="meterNo" name="meterNo" maxLength={60} />
        </div>

        {meterState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${meterState.error}` as never)}
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

      <form action={readingAction} className="flex max-w-xl flex-col gap-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newReading")}</h2>

        <div>
          <Label htmlFor="meterId">{t("meter")}</Label>
          <select id="meterId" name="meterId" className={selectClass} required>
            <option value="">{t("selectMeter")}</option>
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="readOn">{t("readOn")}</Label>
          <Input id="readOn" name="readOn" type="date" required />
        </div>

        <div>
          <Label htmlFor="value">{t("value")}</Label>
          <Input id="value" name="value" type="number" step="0.001" min="0" required />
        </div>

        {readingState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${readingState.error}` as never)}
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
    </div>
  );
}
