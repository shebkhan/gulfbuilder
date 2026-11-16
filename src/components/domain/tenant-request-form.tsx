"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createTenantRequestAction, type PortalState } from "@/server/actions/portal";

export function TenantRequestForm() {
  const t = useTranslations("portal.requests");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PortalState>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({});
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createTenantRequestAction({}, formData);
      setState(result);
      if (result.ok) event.currentTarget.reset();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-container-lowest p-4"
    >
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newTitle")}</h2>

      {state.error && (
        <p className="rounded-lg bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
          {t(`errors.${state.error}` as never)}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-secondary-container p-3 font-body-sm text-body-sm text-on-secondary-container">
          {t("created")}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">
          {t("title")}
        </span>
        <input
          required
          name="title"
          type="text"
          maxLength={120}
          className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">
          {t("description")}
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={1000}
          className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {t("category")}
          </span>
          <select
            name="category"
            defaultValue="general"
            className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="general">{t("categories.general")}</option>
            <option value="plumbing">{t("categories.plumbing")}</option>
            <option value="electrical">{t("categories.electrical")}</option>
            <option value="air_conditioning">{t("categories.air_conditioning")}</option>
            <option value="appliance">{t("categories.appliance")}</option>
            <option value="other">{t("categories.other")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {t("priority")}
          </span>
          <select
            name="priority"
            defaultValue="normal"
            className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="low">{t("priorities.low")}</option>
            <option value="normal">{t("priorities.normal")}</option>
            <option value="high">{t("priorities.high")}</option>
            <option value="urgent">{t("priorities.urgent")}</option>
          </select>
        </label>
      </div>

      <Button type="submit" disabled={isPending} className="flex items-center justify-center gap-2">
        <Send className="size-4" />
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
