"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOOKUP_CATEGORIES } from "@/schemas/platform-admin";
import { deleteLookupAction, upsertLookupAction } from "@/server/actions/platform-org";

export type LookupRow = {
  id: string;
  category: (typeof LOOKUP_CATEGORIES)[number];
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export function PlatformLookupsManager({ orgId, rows }: { orgId: string; rows: LookupRow[] }) {
  const t = useTranslations("platform.lookups");
  const [upsertState, upsertAction, upsertPending] = useActionState(upsertLookupAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteLookupAction, {});

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("hint")}</p>

      <div className="overflow-x-auto">
        <table className="w-full font-body-sm text-body-sm">
          <thead className="text-on-surface-variant">
            <tr className="border-b border-surface-container-high">
              <th className="py-2 text-start font-medium">{t("category")}</th>
              <th className="py-2 text-start font-medium">{t("code")}</th>
              <th className="py-2 text-start font-medium">{t("label")}</th>
              <th className="py-2 text-start font-medium">{t("sortOrder")}</th>
              <th className="py-2 text-start font-medium">{t("active")}</th>
              <th className="py-2 text-start font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const formId = `lookup-${row.id}`;
              return (
                <tr key={row.id} className="border-b border-surface-container-low">
                  <td className="py-2">
                    <select
                      form={formId}
                      name="category"
                      defaultValue={row.category}
                      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm"
                    >
                      {LOOKUP_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <Input form={formId} name="code" defaultValue={row.code} dir="ltr" required />
                  </td>
                  <td className="py-2">
                    <Input form={formId} name="label" defaultValue={row.label} required />
                  </td>
                  <td className="py-2">
                    <Input
                      form={formId}
                      name="sortOrder"
                      type="number"
                      min={0}
                      defaultValue={row.sortOrder}
                      className="w-20"
                    />
                  </td>
                  <td className="py-2">
                    <Checkbox form={formId} name="isActive" defaultChecked={row.isActive} />
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <form id={formId} action={upsertAction}>
                        <input type="hidden" name="orgId" value={orgId} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="isActive" value="off" />
                        <Button type="submit" size="sm" disabled={upsertPending}>
                          {t("save")}
                        </Button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="orgId" value={orgId} />
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" size="sm" variant="secondary" disabled={deletePending}>
                          {t("delete")}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={upsertAction} className="grid gap-3 sm:grid-cols-6">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="isActive" value="off" />
        <Select name="category" defaultValue={LOOKUP_CATEGORIES[0]}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOOKUP_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category} dir="ltr">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input name="code" placeholder={t("code")} dir="ltr" required />
        <Input name="label" placeholder={t("label")} required />
        <Input name="sortOrder" type="number" min={0} defaultValue={0} placeholder={t("sortOrder")} />
        <Checkbox name="isActive" defaultChecked aria-label={t("active")} />
        <Button type="submit" disabled={upsertPending}>
          {t("add")}
        </Button>
      </form>

      {upsertState.error || deleteState.error ? (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {t(
            `errors.${upsertState.error ?? deleteState.error}` as never,
          )}
        </p>
      ) : null}
      {upsertState.ok || deleteState.ok ? (
        <p role="status" className="font-body-sm text-body-sm text-secondary">
          {deleteState.ok ? t("deleted") : t("saved")}
        </p>
      ) : null}
    </div>
  );
}
