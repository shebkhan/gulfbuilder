"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  savePushSubscriptionAction,
  removePushSubscriptionAction,
  type SettingsState,
} from "@/server/actions/settings";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function WebPushCard() {
  const t = useTranslations("settings.notifications");
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, saveAction] = useActionState<SettingsState, FormData>(
    savePushSubscriptionAction,
    {},
  );
  const [removeState, removeAction] = useActionState<SettingsState, FormData>(
    removePushSubscriptionAction,
    {},
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setEndpoint(subscription?.endpoint ?? null))
      .catch(() => undefined);
  }, []);

  async function enable() {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      setEndpoint(subscription.endpoint);
      const formData = new FormData();
      formData.set("subscription", JSON.stringify(subscription));
      saveAction(formData);
    } catch {
      // Permission denied or subscribe failed; leave the current state unchanged.
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      if (endpoint) {
        const formData = new FormData();
        formData.set("endpoint", endpoint);
        removeAction(formData);
      }
      setEndpoint(null);
    } finally {
      setBusy(false);
    }
  }

  const error = saveState.error ?? removeState.error;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t("pushTitle")}</CardTitle>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t("pushSubtitle")}</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 pt-0">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${error}` as never)}
          </p>
        ) : null}
        {endpoint ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={disable}>
            {t("disablePush")}
          </Button>
        ) : (
          <Button type="button" disabled={busy || !publicKey} onClick={enable}>
            {t("enablePush")}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
