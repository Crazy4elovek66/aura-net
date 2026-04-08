import "server-only";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const globalCache = globalThis as typeof globalThis & {
  __auraRuntimeCache?: Map<string, CacheEntry<unknown>>;
  __auraRuntimeCacheInflight?: Map<string, Promise<unknown>>;
};

const runtimeCache = globalCache.__auraRuntimeCache ?? new Map<string, CacheEntry<unknown>>();
const inflightCache = globalCache.__auraRuntimeCacheInflight ?? new Map<string, Promise<unknown>>();

if (!globalCache.__auraRuntimeCache) {
  globalCache.__auraRuntimeCache = runtimeCache;
}

if (!globalCache.__auraRuntimeCacheInflight) {
  globalCache.__auraRuntimeCacheInflight = inflightCache;
}

export async function getOrSetRuntimeCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = runtimeCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existingInflight = inflightCache.get(key) as Promise<T> | undefined;
  if (existingInflight) {
    return existingInflight;
  }

  const loadPromise = loader()
    .then((value) => {
      runtimeCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });

      return value;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, loadPromise);

  return loadPromise;
}

export function buildCacheControl(ttlMs: number, staleWhileRevalidateMs = ttlMs) {
  const maxAgeSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  const staleSeconds = Math.max(maxAgeSeconds, Math.floor(staleWhileRevalidateMs / 1000));
  return `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`;
}
