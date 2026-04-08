import "server-only";

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
