"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import { uploadSchema } from "@/schemas/documents";
import { uploadDocumentAction, type DocumentState } from "@/server/actions/documents";

type Values = {
  entityType: "lease" | "tenant" | "building" | "unit" | "vendor" | "inspection";
  entityId: string;
  kind: "contract" | "id_card" | "trade_license" | "title_deed" | "photo" | "receipt";
  expiresOn?: string;
  notes?: string;
  file?: File | null;
};

export function DocumentUploadForm({
  entities,
  defaultEntityType = "lease",
}: {
  entities: { id: string; label: string }[];
  defaultEntityType?: string;
}) {
  const t = useTranslations("documents");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      entityType: defaultEntityType as Values["entityType"],
      entityId: "",
      kind: "contract",
      expiresOn: "",
      notes: "",
      file: null,
    },
  });

  const [state, dispatch, pending] = useActionState<DocumentState, FormData>(
    async (prev, formData) => {
      const res = await uploadDocumentAction(prev, formData);
      if (res.ok) form.reset();
      return res;
    },
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => dispatch(toFormData(form.getValues())))}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="entityType"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.entityType}>{t("entityType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["lease", "tenant", "building", "unit", "vendor", "inspection"] as const).map(
                      (kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t(`entityTypes.${kind}` as never)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="entityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.entity}>{t("entity")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectEntity")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField
            control={form.control}
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
                    {(
                      [
                        "contract",
                        "id_card",
                        "trade_license",
                        "title_deed",
                        "photo",
                        "receipt",
                      ] as const
                    ).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`kinds.${kind}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiresOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={help.expiresOn}>{t("expiresOn")}</FormLabel>
                <FormControl>
                  <DatePicker {...field} value={field.value ?? ""} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="file"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={help.file}>{t("file")}</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
                />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {errors[state.error] ?? state.error}
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
    </Form>
  );
}
