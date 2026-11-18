"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOrgIntegrationAction } from "@/server/actions/platform-org";

export type TelegramConfig = {
  botToken: string;
  botName: string;
  chatId: string;
  enabled: boolean;
};

export function PlatformTelegramForm({ orgId, config }: { orgId: string; config: TelegramConfig }) {
  const t = useTranslations("platform.telegram");
  const [state, action, pending] = useActionState(saveOrgIntegrationAction, {});

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="provider" value="telegram" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("hint")}</p>
      <div>
        <Label htmlFor="tg-token">{t("botToken")}</Label>
        <Input
          id="tg-token"
          name="botToken"
          type="password"
          autoComplete="new-password"
          placeholder={config.botToken ? "••••••" : undefined}
          dir="ltr"
        />
      </div>
      <div>
        <Label htmlFor="tg-name">{t("botName")}</Label>
        <Input id="tg-name" name="botName" defaultValue={config.botName} required />
      </div>
      <div>
        <Label htmlFor="tg-chat">{t("chatId")}</Label>
        <Input id="tg-chat" name="chatId" defaultValue={config.chatId} dir="ltr" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="tg-enabled" name="enabled" defaultChecked={config.enabled} />
        <Label htmlFor="tg-enabled">{t("enabled")}</Label>
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
