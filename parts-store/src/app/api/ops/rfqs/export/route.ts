import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { rfqsToCsv } from "@/lib/csv";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { listRfqs } from "@/lib/rfqStore";

/**
 * Ops CSV export — the full RFQ book as a spreadsheet for quoting, follow-up,
 * and QuickBooks entry. Ops session required (this is PII). Never cached.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!verifySession((await cookies()).get(OPS_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const rfqs = await listRfqs();
  audit("ops_export", { n: rfqs.length });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(rfqsToCsv(rfqs), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jme-rfqs-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
