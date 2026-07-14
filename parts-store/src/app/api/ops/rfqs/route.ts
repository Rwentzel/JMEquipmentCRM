import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { listRfqs, rfqCounts, updateRfqStatus, RFQ_STATUSES, type RfqStatus } from "@/lib/rfqStore";

/**
 * Ops RFQ API — the ONLY read path to stored RFQs (which contain contact
 * PII). Every method requires a valid ops session. Never cached.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  return verifySession((await cookies()).get(OPS_COOKIE)?.value);
}

export async function GET() {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });
  const [rfqs, counts] = await Promise.all([listRfqs(), rfqCounts()]);
  return NextResponse.json({ ok: true, rfqs, counts });
}

export async function PATCH(req: Request) {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });

  let body: { ref?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ref = String(body.ref ?? "");
  const status = String(body.status ?? "") as RfqStatus;
  if (!ref || !RFQ_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: "Unknown ref or status." }, { status: 422 });
  }

  const updated = await updateRfqStatus(ref, status);
  if (!updated) return NextResponse.json({ ok: false, error: "Unknown ref." }, { status: 404 });

  audit("ops_status_change");
  return NextResponse.json({ ok: true, rfq: updated });
}
