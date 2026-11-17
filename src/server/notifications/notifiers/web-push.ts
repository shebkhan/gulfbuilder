import { sendNotification } from "web-push";
import type { Notifier, Outbound, SendResult } from "../notifier";
import { dryRunSend, isDryRun } from "../notifier";

export const webPushNotifier: Notifier = {
  async send(message: Outbound): Promise<SendResult> {
    if (isDryRun()) return dryRunSend("push", message.recipient);
    const subscription = message.subscription;
    if (!subscription) return { ok: false, error: "not_configured" };
    try {
      // subject defaults per web-push when VAPID env values are unset.
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ title: message.subject ?? "Notification", body: message.body }),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "web_push_failed" };
    }
  },
};
