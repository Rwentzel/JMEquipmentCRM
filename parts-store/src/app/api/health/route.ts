import { NextResponse } from "next/server";

/**
 * Liveness probe for uptime monitoring. Deliberately minimal — no version,
 * no dependency detail, nothing enumerable. Deep health lives behind the
 * ops-authed maintenance agent.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true });
}
