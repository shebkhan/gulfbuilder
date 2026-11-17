import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOutbound } from "./recipient";

type Row = Record<string, unknown>;

// Minimal thenable query-builder stub: from/select/eq/maybeSingle is all resolveOutbound uses.
function fakeAdmin(tables: Record<string, Row[]>): SupabaseClient {
  const from = (table: string, select = "*") => {
    const rows = tables[table] ?? [];
    const columns = select === "*" ? null : select.split(",");
    const filters: Array<[string, unknown]> = [];
    const matches = () =>
      rows
        .filter((row) => filters.every(([column, value]) => row[column] === value))
        .map((row) => Object.fromEntries((columns ?? Object.keys(row)).map((c) => [c, row[c]])));
    const builder = {
      select: (columns: string) => from(table, columns),
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
      then: (resolve: (result: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: matches(), error: null }),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

describe("resolveOutbound", () => {
  const base = { org_id: "org-1", subject: "Hi", body: "Body" };

  it("keeps the email recipient unchanged and resolves the brand from address", async () => {
    const row = { ...base, channel: "email", recipient: "a@b.c" };
    const out = await resolveOutbound(row, fakeAdmin({}));
    expect(out).toEqual([{ channel: "email", recipient: "a@b.c", subject: "Hi", body: "Body" }]);

    const branded = await resolveOutbound(row, fakeAdmin({ org_branding: [{ org_id: "org-1", email_from: "Gulf <no-reply@gulf.example>" }] }));
    expect(branded).toEqual([
      { channel: "email", recipient: "a@b.c", subject: "Hi", body: "Body", from: "Gulf <no-reply@gulf.example>" },
    ]);
  });

  it("resolves telegram recipients from the profile chat id, or none", async () => {
    const row = { ...base, channel: "telegram", recipient: "user-1" };
    const out = await resolveOutbound(row, fakeAdmin({ profiles: [{ id: "user-1", telegram_chat_id: "chat-9" }] }));
    expect(out).toEqual([{ channel: "telegram", recipient: "chat-9", subject: "Hi", body: "Body" }]);

    const none = await resolveOutbound(row, fakeAdmin({ profiles: [{ id: "user-1", telegram_chat_id: null }] }));
    expect(none).toEqual([]);
  });

  it("yields one push outbound per subscription", async () => {
    const subs = [
      { endpoint: "https://ep/1", p256dh: "k1", auth: "a1" },
      { endpoint: "https://ep/2", p256dh: "k2", auth: "a2" },
    ];
    const out = await resolveOutbound(
      { ...base, channel: "push", recipient: "user-1" },
      fakeAdmin({
        web_push_subscriptions: [
          ...subs.map((s) => ({ ...s, user_id: "user-1" })),
          { endpoint: "https://ep/other", p256dh: "k3", auth: "a3", user_id: "user-2" },
        ],
      }),
    );
    expect(out).toEqual(
      subs.map((subscription) => ({ channel: "push", recipient: "user-1", subject: "Hi", body: "Body", subscription })),
    );
  });

  it("returns nothing for unknown channels", async () => {
    const out = await resolveOutbound({ ...base, channel: "fax", recipient: "x" }, fakeAdmin({}));
    expect(out).toEqual([]);
  });
});
