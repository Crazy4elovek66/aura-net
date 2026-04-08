import "server-only";

import { NextResponse } from "next/server";
import type { RateLimitState } from "@/lib/server/rate-limit";

export function buildRateLimitHeaders(state: RateLimitState) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil(state.retryAfterMs / 1000))),
    "X-RateLimit-Limit": String(state.limit),
    "X-RateLimit-Remaining": String(state.remaining),
    "X-RateLimit-Reset": new Date(state.resetAt).toISOString(),
  };
}

export function buildRateLimitResponse(message: string, state: RateLimitState) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: buildRateLimitHeaders(state),
    },
  );
}
