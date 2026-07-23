import { NextResponse } from "next/server";
import { audit, hashKey } from "@/lib/auditLog";
import { acceptQuote } from "@/lib/qc/store";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Customer quote acceptance — token-gated (constant-time), rate-limited,
 * generic responses, no PII logged. Only draft/sent/accepted quotes can be
 * (re)accepted; won/lost are terminal.
 */

export const runtime = "nodejs";

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  const key = clientKey(req);
  const rl = rateLimit(`qc-accept:${key}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  let body: { id?: unknown; token?: unknown; signedName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const signedName = String(body.signedName ?? "").trim().slice(0, 120);
  if (!signedName) return NextResponse.json({ ok: false }, { status: 422 });

  const quote = await acceptQuote(String(body.id ?? ""), String(body.token ?? ""), signedName);
  if (!quote) {
    audit("qc_accept", { keyHash: hashKey(key), n: 0 });
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  audit("qc_accept", { n: 1 });
  return NextResponse.json({ ok: true });
}
