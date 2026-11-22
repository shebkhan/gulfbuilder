"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateListingAction, addListingImageAction, type ListingState } from "@/server/actions/listings";

const initial: ListingState = {};

export function ListingMetadataForm({
  unitId,
  buildingId,
  isListed,
  title,
  description,
  slug,
}: {
  unitId: string;
  buildingId: string;
  isListed: boolean;
  title: string | null;
  description: string | null;
  slug: string | null;
}) {
  const t = useTranslations("marketplace.admin");
  const [state, action, pending] = useActionState<ListingState, FormData>(
    updateListingAction,
    initial,
  );

  const err = state.error ? t(`errors.${state.error}` as never) : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="buildingId" value={buildingId} />

      <label className="flex items-center gap-2">
        <input type="checkbox" name="isListed" value="true" defaultChecked={isListed} />
        <span className="font-body-md text-body-md text-on-surface">{t("listed")}</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{t("titleField")}</Label>
        <Input id="title" name="title" defaultValue={title ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{t("descriptionField")}</Label>
        <Textarea id="description" name="description" defaultValue={description ?? ""} rows={4} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">{t("slugField")}</Label>
        <Input id="slug" name="slug" defaultValue={slug ?? ""} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t("slugHint")}</p>
      </div>

      {err ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {err}
        </p>
      ) : null}
      {state.ok === "saved" ? (
        <p role="status" className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
          {t("saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

export function ListingImageUploadForm({ unitId, buildingId }: { unitId: string; buildingId: string }) {
  const t = useTranslations("marketplace.admin");
  const [state, action, pending] = useActionState<ListingState, FormData>(
    addListingImageAction,
    initial,
  );

  const err = state.error ? t(`errors.${state.error}` as never) : null;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-hairline p-4">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="buildingId" value={buildingId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">{t("addImage")}</Label>
        <Input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="altText">{t("altText")}</Label>
        <Input id="altText" name="altText" />
      </div>
      {err ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {err}
        </p>
      ) : null}
      {state.ok === "uploaded" ? (
        <p role="status" className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container">
          {t("uploaded")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("uploading") : t("addImage")}
      </Button>
    </form>
  );
}