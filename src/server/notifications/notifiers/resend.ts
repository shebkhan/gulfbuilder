import type { Notifier, Outbound, SendResult } from "../notifier";
import { dryRunSend, isDryRun, outboundTitle } from "../notifier";

export const resendNotifier: Notifier = {
  async send(message: Outbound): Promise<SendResult> {
    if (isDryRun()) return dryRunSend("email", message.recipient);
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!apiKey || !from) return { ok: false, error: "not_configured" };
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: message.recipient,
          subject: outboundTitle(message),
          text: message.body,
        }),
      });
      if (!response.ok) return { ok: false, error: `resend_http_${response.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "resend_failed" };
    }
  },
};
