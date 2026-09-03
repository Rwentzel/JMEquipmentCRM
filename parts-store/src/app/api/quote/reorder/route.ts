import { NextResponse } from "next/server";
import { audit, hashKey } from "@/lib/auditLog";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { getRfq } from "@/lib/rfqStore";
import { matchReorder, normalizeRef } from "@/lib/reorder";

/**
 * POST /api/quote/reorder  { ref, email }  →  { ok, ref, items:[{sku,qty}] }
 *
 * Public, rate-limited, no session. Returns only public catalog identifiers;
 * a wrong email, unknown reference, or malformed input all get the same 404
 * so nothing about stored requests can be probed. See lib/reorder.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISS = { ok: false, error: "No request found for that reference and email." };

export async function POST(req: Request) {
  const key = clientKey(req);
  const rl = rateLimit(`reorder:${key}`, 10, 60_000);
  if (!rl.ok) {
    audit("reorder_rate_limited", { keyHash: hashKey(key) });
    return NextResponse.json(
      { ok: false, error: "Too many lookups. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { ref?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(MISS, { status: 404 });
  }

  const ref = normalizeRef(body.ref);
  if (!ref) return NextResponse.json(MISS, { status: 404 });

  const rfq = await getRfq(ref).catch(() => null);
  const items = matchReorder(rfq, body.email);
  if (!items) {
    audit("reorder_miss", { keyHash: hashKey(key) });
    return NextResponse.json(MISS, { status: 404 });
  }

  audit("reorder_lookup", { n: items.length });
  return NextResponse.json({ ok: true, ref, items }, { headers: { "Cache-Control": "no-store" } });
}
