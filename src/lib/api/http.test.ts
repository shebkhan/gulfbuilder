import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { ApiError } from "./errors";
import { errorResponse, jsonResponse } from "./http";

function get(ifNoneMatch?: string) {
  return new Request("http://localhost/api/v1/me", {
    headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {},
  });
}

describe("jsonResponse", () => {
  it("wraps data and sets a cacheable ETag", async () => {
    const res = jsonResponse(get(), { ok: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
    expect(res.headers.get("etag")).toMatch(/^W\/"/);
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("answers 304 when the ETag still matches", async () => {
    const first = jsonResponse(get(), { ok: true });
    const etag = first.headers.get("etag")!;
    const second = jsonResponse(get(etag), { ok: true });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("gives a different ETag for different bodies", () => {
    const a = jsonResponse(get(), { n: 1 }).headers.get("etag");
    const b = jsonResponse(get(), { n: 2 }).headers.get("etag");
    expect(a).not.toBe(b);
  });

  it("never caches no-store responses", () => {
    const res = jsonResponse(get(), { money: 1 }, "no-store");
    expect(res.headers.get("etag")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store, private");
  });
});

describe("errorResponse", () => {
  it("maps ApiError codes to the right status", async () => {
    const res = errorResponse(new ApiError("mfa_required"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "mfa_required", message: "mfa_required" },
    });
  });

  it("includes field errors for invalid input", async () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    expect(parsed.success).toBe(false);

    const res = errorResponse(parsed.error as ZodError);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "invalid_input",
        message: "Invalid input",
        fields: { name: "Required" },
      },
    });
  });

  it("hides unexpected errors behind internal", async () => {
    const res = errorResponse(new Error("db password leaked in message"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal", message: "Internal error" },
    });
  });
});
