import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { retryAt } from "./backoff";
import { notifierFor, type Outbound } from "./notifier";
import { resolveOutbound } from "./recipient";
import { linkTelegramCodes } from "./telegram-link";

export { linkTelegramCodes };

export type DispatchCounts = { claimed: number; sent: number; failed: number; skipped: number };

const BATCH_LIMIT = 50;

export async function dispatchPending(): Promise<DispatchCounts> {
  const admin = createSupabaseAdminClient();
  await linkTelegramCodes(admin);
  const { data: rows, error } = await admin.rpc("claim_notification_batch", { p_limit: BATCH_LIMIT });
  if (error) throw error;
  const counts: DispatchCounts = { claimed: rows.length, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const messages = await resolveOutbound(row, admin);
    if (messages.length === 0) {
      counts.skipped += 1;
      await admin
        .from("notification_outbox")
        .update({ status: "failed", error: "no_recipient", claimed_at: null })
        .eq("id", row.id);
      continue;
    }
    const sendError = await sendAll(messages);
    if (sendError === null) {
      counts.sent += 1;
      await admin
        .from("notification_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null, claimed_at: null })
        .eq("id", row.id);
      continue;
    }
    counts.failed += 1;
    const attempts = row.attempts + 1;
    const scheduledFor = retryAt(attempts, new Date());
    await admin
      .from("notification_outbox")
      .update(
        scheduledFor
          ? { status: "pending", attempts, error: sendError, claimed_at: null, scheduled_for: scheduledFor.toISOString() }
          : { status: "failed", attempts, error: sendError, claimed_at: null },
      )
      .eq("id", row.id);
  }
  return counts;
}

// First send failure marks the row for retry; earlier successes re-send on that retry.
async function sendAll(messages: Outbound[]): Promise<string | null> {
  for (const message of messages) {
    const notifier = notifierFor(message.channel);
    const result = notifier ? await notifier.send(message) : { ok: false as const, error: "no_notifier" };
    if (!result.ok) return result.error;
  }
  return null;
}
