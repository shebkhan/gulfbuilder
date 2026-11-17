"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
      className="flex flex-col gap-6 rounded-xl border border-hairline bg-surface-container-lowest p-4"
    >
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("newTitle")}</h2>

      {state.error && (
        <p className="rounded-lg bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
          {t(`errors.${state.error}` as never)}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          className="rounded-lg bg-secondary-container p-3 font-body-sm text-body-sm text-on-secondary-container"
        >
          {t("created")}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-title">{t("title")}</Label>
        <Input id="request-title" required name="title" type="text" maxLength={120} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-description">{t("description")}</Label>
        <Textarea id="request-description" name="description" rows={3} maxLength={1000} />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-category">{t("category")}</Label>
          <Select name="category" defaultValue="general">
            <SelectTrigger id="request-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">{t("categories.general")}</SelectItem>
              <SelectItem value="plumbing">{t("categories.plumbing")}</SelectItem>
              <SelectItem value="electrical">{t("categories.electrical")}</SelectItem>
              <SelectItem value="air_conditioning">{t("categories.air_conditioning")}</SelectItem>
              <SelectItem value="appliance">{t("categories.appliance")}</SelectItem>
              <SelectItem value="other">{t("categories.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-priority">{t("priority")}</Label>
          <Select name="priority" defaultValue="normal">
            <SelectTrigger id="request-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t("priorities.low")}</SelectItem>
              <SelectItem value="normal">{t("priorities.normal")}</SelectItem>
              <SelectItem value="high">{t("priorities.high")}</SelectItem>
              <SelectItem value="urgent">{t("priorities.urgent")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="flex items-center justify-center gap-2">
        <Send className="size-4" />
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
