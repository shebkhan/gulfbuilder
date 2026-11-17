import { sendNotification, setVapidDetails } from "web-push";
import type { Notifier, Outbound, SendResult } from "../notifier";
import { dryRunSend, isDryRun, outboundTitle } from "../notifier";

export const webPushNotifier: Notifier = {
  async send(message: Outbound): Promise<SendResult> {
    if (isDryRun()) return dryRunSend("push", message.recipient);
    const subscription = message.subscription;
    const subject = process.env.WEB_PUSH_SUBJECT;
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    // Push endpoints reject sends without a VAPID identity, so these count as required config.
    if (!subscription || !subject || !publicKey || !privateKey) {
      return { ok: false, error: "not_configured" };
    }
    try {
      setVapidDetails(subject, publicKey, privateKey);
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ title: outboundTitle(message), body: message.body }),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "web_push_failed" };
    }
  },
};
