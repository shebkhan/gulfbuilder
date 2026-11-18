"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ThemePresetInput } from "@/schemas/theme";
import {
  setDefaultThemePresetAction,
  upsertThemePresetAction,
  type PlatformState,
} from "@/server/actions/platform";

export function ThemePresetForm({ initial }: { initial?: ThemePresetInput }) {
  const t = useTranslations("platform.themes");
  const key = initial?.code ?? "new";
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    upsertThemePresetAction,
    {},
  );
  const [defaultState, defaultAction, defaultPending] = useActionState<PlatformState, FormData>(
    setDefaultThemePresetAction,
    {},
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-x-3 gap-y-6 sm:grid-cols-2">
          <div>
            <Label htmlFor={`code-${key}`}>{t("code")}</Label>
            <Input
              id={`code-${key}`}
              name="code"
              dir="ltr"
              maxLength={80}
              defaultValue={initial?.code ?? ""}
              readOnly={Boolean(initial)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`name-${key}`}>{t("name")}</Label>
            <Input
              id={`name-${key}`}
              name="name"
              maxLength={80}
              defaultValue={initial?.name ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor={`primary-${key}`}>{t("primaryColor")}</Label>
            <Input
              id={`primary-${key}`}
              name="primaryColor"
              dir="ltr"
              maxLength={7}
              defaultValue={initial?.primaryColor ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor={`secondary-${key}`}>{t("secondaryColor")}</Label>
            <Input
              id={`secondary-${key}`}
              name="secondaryColor"
              dir="ltr"
              maxLength={7}
              defaultValue={initial?.secondaryColor ?? ""}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`font-${key}`}>{t("fontFamily")}</Label>
            <Input
              id={`font-${key}`}
              name="fontFamily"
              dir="ltr"
              maxLength={80}
              defaultValue={initial?.fontFamily ?? ""}
              required
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`default-${key}`}
            name="isDefault"
            defaultChecked={initial?.isDefault ?? false}
          />
          <Label
            htmlFor={`default-${key}`}
            className="mb-0 font-body-sm normal-case tracking-normal text-on-surface"
          >
            {t("isDefault")}
          </Label>
        </div>
        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${state.error}` as never)}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="font-body-sm text-body-sm text-secondary">
            {t("saved")}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t("working") : t("save")}
        </Button>
      </form>
      {initial ? (
        <form action={defaultAction} className="flex flex-col gap-2">
          <input type="hidden" name="code" value={initial.code} />
          {defaultState.error ? (
            <p
              role="alert"
              className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
            >
              {t(`errors.${defaultState.error}` as never)}
            </p>
          ) : null}
          {defaultState.ok ? (
            <p role="status" className="font-body-sm text-body-sm text-secondary">
              {t("defaultSaved")}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" size="sm" disabled={defaultPending} className="self-start">
            {defaultPending ? t("working") : t("setDefault")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
