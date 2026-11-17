import { describe, expect, it } from "vitest";
import { isDryRun, notifierFor } from "./notifier";

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
    process.env.NOTIFICATION_DRY_RUN = "1";
    expect(isDryRun()).toBe(true);
  });
});
