import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("OPENAI_API_KEY", "test-key");

let mod: typeof import("./cheque-ocr");

beforeAll(async () => {
  mod = await import("./cheque-ocr");
});

describe("parseChequeImage", () => {
  it("returns null when API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await mod.parseChequeImage("AAAA", "image/png");
    expect(result).toBeNull();
  });

  it("parses valid JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chequeNo: "12345",
                  bankName: "QNB",
                  amount: "5000.00",
                  chequeDate: "2026-12-01",
                  payee: "Acme LLC",
                }),
              },
            },
          ],
        }),
      }),
    );
    const result = await mod.parseChequeImage("AAAA", "image/png");
    expect(result?.chequeNo).toBe("12345");
    expect(result?.bankName).toBe("QNB");
    expect(result?.amount).toBe("5000.00");
    expect(result?.chequeDate).toBe("2026-12-01");
    expect(result?.payee).toBe("Acme LLC");
  });

  it("returns null on invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "not json" } }] }),
      }),
    );
    const result = await mod.parseChequeImage("AAAA", "image/png");
    expect(result).toBeNull();
  });
});
