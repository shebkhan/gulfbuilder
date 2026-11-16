"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadDocumentAction, type DocumentState } from "@/server/actions/documents";

export function DocumentUploadForm({
  entities,
  defaultEntityType = "lease",
}: {
  entities: { id: string; label: string }[];
  defaultEntityType?: string;
}) {
  const t = useTranslations("documents");
  const [state, formAction, pending] = useActionState<DocumentState, FormData>(
    uploadDocumentAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="entityType">{t("entityType")}</Label>
          <select
            id="entityType"
            name="entityType"
            defaultValue={defaultEntityType}
            className="h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed"
          >
            {(["lease", "tenant", "building", "unit", "vendor", "inspection"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {t(`entityTypes.${kind}` as never)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="entityId">{t("entity")}</Label>
          <select
            id="entityId"
            name="entityId"
            className="h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed"
            required
          >
            <option value="">{t("selectEntity")}</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="kind">{t("kind")}</Label>
          <select
            id="kind"
            name="kind"
            defaultValue="contract"
            className="h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed"
          >
            {(["contract", "id_card", "trade_license", "title_deed", "photo", "receipt"] as const).map(
              (kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}` as never)}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <Label htmlFor="expiresOn">{t("expiresOn")}</Label>
          <Input id="expiresOn" name="expiresOn" type="date" />
        </div>
      </div>

      <div>
        <Label htmlFor="file">{t("file")}</Label>
        <Input id="file" name="file" type="file" required />
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
        <p
          role="status"
          className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
        >
          {t("uploaded")}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        <Upload />
        {pending ? t("uploading") : t("upload")}
      </Button>
    </form>
  );
}
