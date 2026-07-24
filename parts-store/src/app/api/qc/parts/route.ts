import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { PARTS_MASTER } from "@/lib/qc/partsMaster";

/**
 * INTERNAL parts master (1,892 rows with dealer prices + stock) for the
 * quote builder and parts catalog views. Ops session required — this data
 * must never reach the public bundle (see DATA_BOUNDARIES.md).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!verifySession((await cookies()).get(OPS_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return NextResponse.json({ ok: true, parts: PARTS_MASTER });
}
