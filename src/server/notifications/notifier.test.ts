import { afterEach, describe, expect, it, vi } from "vitest";
import { isDryRun, notifierFor, outboundTitle } from "./notifier";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notifierFor", () => {
  it("routes each channel to an adapter with a send function", () => {
    for (const channel of ["email", "sms", "telegram", "push"] as const) {
      const notifier = notifierFor(channel);
      expect(notifier).not.toBeNull();
      expect(typeof notifier?.send).toBe("function");
    }
  });

  it("returns null for unsupported channels", () => {
    expect(notifierFor("whatsapp" as never)).toBeNull();
  });
});

describe("isDryRun", () => {
  it("is true when NOTIFICATION_DRY_RUN=1", () => {
    vi.stubEnv("NOTIFICATION_DRY_RUN", "1");
    expect(isDryRun()).toBe(true);
  });
});

describe("outboundTitle", () => {
  const message = { channel: "email", recipient: "a@b.c", body: "" } as const;

  it("prefers the subject and falls back to a body prefix", () => {
    expect(outboundTitle({ ...message, subject: "Rent due", body: "Pay by Friday" })).toBe(
      "Rent due",
    );
    expect(outboundTitle({ ...message, subject: null, body: "Pay by Friday" })).toBe(
      "Pay by Friday",
    );
  });
});
