import type { Notifier, Outbound, SendResult } from "../notifier";
import { dryRunSend, isDryRun } from "../notifier";

export const telegramNotifier: Notifier = {
  async send(message: Outbound): Promise<SendResult> {
    if (isDryRun()) return dryRunSend("telegram", message.recipient);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { ok: false, error: "not_configured" };
    try {
      const text = message.subject ? `${message.subject}\n\n${message.body}` : message.body;
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: message.recipient, text }),
      });
      if (!response.ok) return { ok: false, error: `telegram_http_${response.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "telegram_failed" };
    }
  },
};
