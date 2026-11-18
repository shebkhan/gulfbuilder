import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse, type CacheMode } from "./http";

/** Every `/api/v1` route goes through here so success and failure share one envelope. */
export async function route(
  request: NextRequest,
  handler: () => Promise<unknown>,
  options: { cache?: CacheMode } = {},
): Promise<Response> {
  try {
    return jsonResponse(request, await handler(), options.cache);
  } catch (error) {
    return errorResponse(error);
  }
}
