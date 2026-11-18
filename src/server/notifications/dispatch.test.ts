import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, rpc } = vi.hoisted(() => ({ calls: [] as string[], rpc: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, params?: Record<string, unknown>) => {
      calls.push(name);
      return rpc(name, params);
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}));
vi.mock("./telegram-link", () => ({
  linkTelegramCodes: async () => {
    calls.push("link");
    return 0;
  },
}));

import { dispatchPending } from "./dispatch";

describe("dispatchPending", () => {
  beforeEach(() => {
    calls.length = 0;
    rpc.mockReset();
  });

  it("runs the reminder scan before claiming the batch", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "enqueue_notification_reminders") return { data: null, error: null };
      return { data: [], error: null };
    });

    await dispatchPending();

    expect(calls).toEqual(["link", "enqueue_notification_reminders", "claim_notification_batch"]);
  });

  it("throws and does not claim when the reminder scan fails", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "enqueue_notification_reminders") return { data: null, error: new Error("scan failed") };
      return { data: [], error: null };
    });

    await expect(dispatchPending()).rejects.toThrow("scan failed");
    expect(calls).toEqual(["link", "enqueue_notification_reminders"]);
  });
});
