import type { Notifier, Outbound, SendResult } from "../notifier";
import { dryRunSend, isDryRun } from "../notifier";

export const twilioNotifier: Notifier = {
  async send(message: Outbound): Promise<SendResult> {
    if (isDryRun()) return dryRunSend("sms", message.recipient);
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !authToken || !from) return { ok: false, error: "not_configured" };
    try {
      const form = new URLSearchParams({ To: message.recipient, From: from, Body: message.body });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      if (!response.ok) return { ok: false, error: `twilio_http_${response.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "twilio_failed" };
    }
  },
};
