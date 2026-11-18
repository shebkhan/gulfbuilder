import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/types/database";
import type { Channel, Outbound } from "./notifier";

type NotificationOutboxRow = Tables<"notification_outbox">;

// recipient convention: email → address, SMS → E.164, telegram/push → user id.
export async function resolveOutbound(
  row: Pick<NotificationOutboxRow, "org_id" | "channel" | "recipient" | "subject" | "body">,
  admin: SupabaseClient,
): Promise<Outbound[]> {
  const channel = row.channel as Channel;
  if (channel === "email" || channel === "sms") {
    const outbound: Outbound = { channel, recipient: row.recipient, subject: row.subject, body: row.body };
    if (channel === "email") {
      const branding = await admin
        .from("org_branding")
        .select("email_from,app_name,logo_url")
        .eq("org_id", row.org_id)
        .maybeSingle();
      if (branding.error) throw new Error("recipient_lookup_failed");
      if (branding.data?.email_from) outbound.from = branding.data.email_from;
      outbound.appName = branding.data?.app_name;
      outbound.logoUrl = branding.data?.logo_url;
    }
    return [outbound];
  }
  if (channel === "telegram") {
    const profile = await admin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", row.recipient)
      .maybeSingle();
    if (profile.error) throw new Error("recipient_lookup_failed");
    if (!profile.data?.telegram_chat_id) return [];
    return [{ channel, recipient: profile.data.telegram_chat_id, subject: row.subject, body: row.body }];
  }
  if (channel === "push") {
    const { data, error } = await admin
      .from("web_push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", row.recipient);
    if (error) throw new Error("recipient_lookup_failed");
    return (data ?? []).map((subscription) => ({
      channel,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      subscription,
    }));
  }
  return [];
}
