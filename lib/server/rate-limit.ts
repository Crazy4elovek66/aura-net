import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface ConsumeRateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitState {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
}

const globalBuckets = globalThis as typeof globalThis & {
  __auraRateLimitBuckets?: Map<string, RateLimitBucket>;
};

const rateLimitBuckets = globalBuckets.__auraRateLimitBuckets ?? new Map<string, RateLimitBucket>();

if (!globalBuckets.__auraRateLimitBuckets) {
  globalBuckets.__auraRateLimitBuckets = rateLimitBuckets;
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function consumeRateLimit({ key, limit, windowMs }: ConsumeRateLimitOptions): RateLimitState {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const current = rateLimitBuckets.get(key);
  const nextBucket =
    current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + windowMs };

  rateLimitBuckets.set(key, nextBucket);

  const allowed = nextBucket.count <= limit;
  const remaining = Math.max(0, limit - nextBucket.count);

  return {
    allowed,
    limit,
    remaining,
    retryAfterMs: Math.max(0, nextBucket.resetAt - now),
    resetAt: nextBucket.resetAt,
  };
}

export async function consumePersistentRateLimit({
  key,
  limit,
  windowMs,
}: ConsumeRateLimitOptions): Promise<RateLimitState> {
  const admin = createAdminClient();
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const { data, error } = await admin.rpc("consume_runtime_rate_limit", {
    p_bucket_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error || !Array.isArray(data) || !data[0]) {
    if (error) {
      console.error("[RateLimit] Persistent limiter failed, falling back to memory", error.message);
    }
    return consumeRateLimit({ key, limit, windowMs });
  }

  const row = data[0] as {
    allowed?: boolean;
    remaining?: number;
    retry_after_seconds?: number;
    reset_at?: string;
  };

  return {
    allowed: Boolean(row.allowed),
    limit,
    remaining: Math.max(0, Number(row.remaining || 0)),
    retryAfterMs: Math.max(0, Number(row.retry_after_seconds || 0) * 1000),
    resetAt: row.reset_at ? new Date(row.reset_at).getTime() : Date.now() + windowMs,
  };
}
