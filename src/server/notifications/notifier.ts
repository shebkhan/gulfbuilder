import { telegramNotifier } from "./notifiers/telegram";
import { resendNotifier } from "./notifiers/resend";
import { twilioNotifier } from "./notifiers/twilio";
import { webPushNotifier } from "./notifiers/web-push";

export const CHANNELS = ["email", "sms", "telegram", "push"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Outbound = {
  channel: Channel;
  recipient: string;
  subject?: string | null;
  body: string;
  from?: string;
  appName?: string | null;
  logoUrl?: string | null;
  subscription?: { endpoint: string; p256dh: string; auth: string };
};
export type SendResult = { ok: true } | { ok: false; error: string };
export interface Notifier {
  send(message: Outbound): Promise<SendResult>;
}

export function isDryRun(): boolean {
  return process.env.NOTIFICATION_DRY_RUN === "1";
}

// Title fallback is a body prefix so no hard-coded English text reaches users (i18n constraint).
export function outboundTitle(message: Outbound): string {
  return message.subject || message.body.slice(0, 64);
}

// Dry-run short-circuit: log channel and recipient only, never tokens or bodies.
export function dryRunSend(channel: Channel, recipient: string): SendResult {
  console.log(`[notifications] dry-run channel=${channel} recipient=${recipient}`);
  return { ok: true };
}

const NOTIFIERS: Record<Channel, Notifier> = {
  email: resendNotifier,
  sms: twilioNotifier,
  telegram: telegramNotifier,
  push: webPushNotifier,
};

export function notifierFor(channel: Channel): Notifier | null {
  return NOTIFIERS[channel] ?? null;
}
