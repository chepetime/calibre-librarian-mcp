/**
 * Simple in-memory cache with TTL for calibredb results.
 * Improves performance by avoiding redundant calibredb process spawns.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Store a value in the cache with optional custom TTL.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and hasn't expired.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached entries.
   * Call this after write operations to ensure data consistency.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clear expired entries (garbage collection).
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get cache statistics.
   */
  stats(): { size: number; keys: string[] } {
    this.prune();
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Singleton cache instance with 30-second default TTL
export const calibreCache = new Cache(30_000);

/**
 * Generate a cache key from calibredb arguments.
 */
export function makeCacheKey(args: string[]): string {
  return `calibredb:${args.join(":")}`;
}

/**
 * Invalidate all cached data.
 * Call this after any write operation (set_metadata, set_custom_column, etc.)
 */
export function invalidateCache(): void {
  calibreCache.clear();
}
