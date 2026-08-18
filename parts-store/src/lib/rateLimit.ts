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

/**
 * Ceiling on tracked keys. Buckets were never evicted, so every distinct key
 * stayed for the life of the process — and the key is derived from a request
 * header, which the caller chooses. Rotating it grew the map without bound:
 * 500k unique keys measured 147 MB of heap that nothing ever released, on a
 * deployment the runbook specifies as a single small instance.
 */
const MAX_BUCKETS = 20_000;

/**
 * Low-water mark. Eviction runs down to here rather than just under the cap,
 * so it fires once per 2000 inserts instead of on every insert once the map is
 * full. The first version evicted to exactly MAX_BUCKETS and sorted the whole
 * map each time, which turned a memory problem into a CPU one: the 500k-key
 * flood that used to finish in seconds did not finish in five minutes.
 */
const EVICT_TO = 18_000;

/**
 * Drop finished windows, then oldest-first until under the low-water mark.
 *
 * Map iterates in insertion order, so "oldest first" costs one delete each
 * rather than a sort of the whole map. Evicting a live bucket does hand that
 * caller a fresh allowance, which is a real cost — but only under a flood
 * large enough to fill the map, where the alternative is the process running
 * out of memory and taking the store down with it.
 */
function evict(now: number): void {
  for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
  while (buckets.size > EVICT_TO) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

/** Number of keys currently tracked. Exposed so the cap can be asserted on. */
export function trackedKeys(): number {
  return buckets.size;
}

/**
 * Identify the caller for rate-limiting purposes.
 *
 * This used to take the FIRST entry of X-Forwarded-For, which is the one value
 * in the whole chain the client fully controls: a header rotated per request
 * gave a fresh bucket every time, and 1000 of 1000 submissions went through a
 * 5-per-minute limit. Platform headers are preferred because the proxy sets
 * them and a client cannot write past it; the X-Forwarded-For fallback takes
 * the LAST hop, which is the entry our own proxy appended rather than anything
 * the client sent.
 *
 * With no proxy in front at all nothing here is trustworthy, and the limiter
 * degrades to per-process — see SECURITY_NOTES.md, which already calls for
 * edge rate limiting in production.
 */
export function clientKey(req: { headers: { get(name: string): string | null } }): string {
  for (const h of ["fly-client-ip", "cf-connecting-ip", "true-client-ip", "x-real-ip"]) {
    const v = req.headers.get(h)?.trim();
    if (v) return v;
  }
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }
  return "local";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Allow up to `limit` requests per `windowMs` for a given key. */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) evict(now);
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
