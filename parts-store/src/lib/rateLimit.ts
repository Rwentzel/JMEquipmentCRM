/**
 * Minimal in-memory rate limiter — SANDBOX ONLY.
 *
 * A fixed-window per-key counter held in process memory. This is adequate for a
 * single-instance sandbox; it does NOT survive restarts and does NOT coordinate
 * across instances. Production must use a shared store (e.g. Redis) or edge
 * rate limiting. See SECURITY_NOTES.md.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Allow up to `limit` requests per `windowMs` for a given key. */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}
