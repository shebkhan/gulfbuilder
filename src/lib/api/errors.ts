export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "mfa_required"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "rate_limited"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  mfa_required: 403,
  not_found: 404,
  invalid_input: 422,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/** Errors the API is allowed to return to a client. Anything else becomes `internal`. */
export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string = code,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = STATUS[code];
  }
}
