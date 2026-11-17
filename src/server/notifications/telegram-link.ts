import type { SupabaseClient } from "@supabase/supabase-js";

export function parseStartCode(text: string): string | null {
  const match = /^\/start (\d{6})(?:@\S+)?$/.exec(text.trim());
  return match?.[1] ?? null;
}

type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; chat: { id: number | string } };
};

/**
 * Poll Telegram getUpdates once and link chats to profiles by matching the
 * six-digit code the user sent to `/start`. Returns the number of links made.
 * Never logs chat IDs — they are personal data.
 */
export async function linkTelegramCodes(admin: SupabaseClient): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return 0;

  const { data: state } = await admin
    .from("telegram_state")
    .select("last_update_id")
    .eq("id", true)
    .maybeSingle();
  const offset = state?.last_update_id ?? 0;

  let updates: TelegramUpdate[];
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return 0;
    const body = (await response.json()) as { ok: boolean; result?: TelegramUpdate[] };
    if (!body.ok || !body.result) return 0;
    updates = body.result;
  } catch {
    return 0;
  }

  let links = 0;
  let maxUpdateId = 0;
  const now = new Date().toISOString();
  for (const update of updates) {
    if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;
    const message = update.message;
    const code = message ? parseStartCode(message.text ?? "") : null;
    if (!code || !message) continue;
    const { data, error } = await admin
      .from("profiles")
      .update({
        telegram_chat_id: String(message.chat.id),
        telegram_link_code: null,
        telegram_link_expires_at: null,
      })
      .eq("telegram_link_code", code)
      .gt("telegram_link_expires_at", now)
      .select("id");
    if (!error && data) links += data.length;
  }

  if (maxUpdateId > 0) {
    await admin
      .from("telegram_state")
      .update({ last_update_id: maxUpdateId + 1 })
      .eq("id", true);
  }
  return links;
}
