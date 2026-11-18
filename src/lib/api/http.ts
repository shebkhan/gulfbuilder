import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "./errors";

/** `private` responses carry an ETag; `no-store` is for money, ledger and tenant PII. */
export type CacheMode = "private" | "no-store";

const NO_STORE = { "Cache-Control": "no-store, private" };

function etagOf(body: string) {
  return `W/"${createHash("sha1").update(body).digest("base64url")}"`;
}

export function jsonResponse(
  request: Request,
  data: unknown,
  cache: CacheMode = "private",
): Response {
  const body = JSON.stringify({ data }, (_, value) =>
    typeof value === "bigint" ? Number(value) : value,
  );

  if (cache === "no-store") {
    return new Response(body, {
      status: 200,
      headers: { ...NO_STORE, "content-type": "application/json" },
    });
  }

  const etag = etagOf(body);
  const headers = {
    ETag: etag,
    "Cache-Control": "private, max-age=0, must-revalidate",
    "content-type": "application/json",
  };

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { status: 200, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status, headers: NO_STORE },
    );
  }

  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [issue.path.join(".") || "_", issue.message]),
    );
    return Response.json(
      { error: { code: "invalid_input", message: "Invalid input", fields } },
      { status: 422, headers: NO_STORE },
    );
  }

  console.error("[api] unhandled error", error instanceof Error ? error.message : error);
  return Response.json(
    { error: { code: "internal", message: "Internal error" } },
    { status: 500, headers: NO_STORE },
  );
}
