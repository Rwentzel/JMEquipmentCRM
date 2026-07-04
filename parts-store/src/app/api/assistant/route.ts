import { NextResponse } from "next/server";
import { answerSupportQuestion } from "@/lib/agents/supportAgent";
import { audit, hashKey } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Support assistant endpoint — public, hardened.
 *
 * Answers come from the support agent, which is grounded exclusively on the
 * public catalog and FAQ (see supportAgent.ts guardrails). Question text is
 * never logged or persisted; the audit trail records counts and hashed
 * client keys only.
 */

export const runtime = "nodejs";

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  const key = clientKey(req);

  const rl = rateLimit(`assistant:${key}`, 10, 60_000);
  if (!rl.ok) {
    audit("assistant_rate_limited", { keyHash: hashKey(key) });
    return NextResponse.json(
      { ok: false, error: "Too many questions at once — give it a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { q?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ask a question about parts or machines." }, { status: 400 });
  }

  const q = String(body.q ?? "").trim();
  if (!q || q.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Ask a question about parts or machines (up to 500 characters)." },
      { status: 422 },
    );
  }

  const result = await answerSupportQuestion(q);
  audit("assistant_query", { n: 1 });

  return NextResponse.json({ ok: true, ...result });
}
