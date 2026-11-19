"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOrgIntegrationAction } from "@/server/actions/platform-org";

export type WhatsappConfig = {
  phone: string;
  enabled: boolean;
};

export function PlatformWhatsappForm({ orgId, config }: { orgId: string; config: WhatsappConfig }) {
  const t = useTranslations("platform.whatsapp");
  const [state, action, pending] = useActionState(saveOrgIntegrationAction, {});

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="provider" value="whatsapp" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("hint")}</p>
      <div>
        <Label htmlFor="wa-phone">{t("phone")}</Label>
        <Input id="wa-phone" name="phone" defaultValue={config.phone} dir="ltr" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="wa-enabled" name="enabled" defaultChecked={config.enabled} />
        <Label htmlFor="wa-enabled">{t("enabled")}</Label>
      </div>
      {state.error ? (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="font-body-sm text-body-sm text-secondary">
          {t("saved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
