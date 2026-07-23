import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { listRfqs, rfqCounts, saveRfqQuote, updateRfqStatus, RFQ_STATUSES, type RfqStatus, type StoredQuoteLine } from "@/lib/rfqStore";

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

  let body: { ref?: unknown; status?: unknown; quote?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ref = String(body.ref ?? "");
  if (!ref) return NextResponse.json({ ok: false, error: "Unknown ref." }, { status: 422 });

  // Path 1: attach/replace a written quotation (parts desk pricing — stays server-side).
  if (body.quote && typeof body.quote === "object") {
    const q = body.quote as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").slice(0, max).trim();
    const rawLines = Array.isArray(q.lines) ? q.lines.slice(0, 30) : [];
    const lines: StoredQuoteLine[] = rawLines
      .map((l) => {
        const row = l as Record<string, unknown>;
        return { label: str(row.label, 140), amount: str(row.amount, 24) };
      })
      .filter((l) => l.label.length > 0);
    const number = str(q.number, 40);
    const total = str(q.total, 24);
    const validDays = Math.min(365, Math.max(1, Math.round(Number(q.validDays)) || 30));
    if (!number || lines.length === 0) {
      return NextResponse.json({ ok: false, error: "Quote needs a number and at least one line." }, { status: 422 });
    }
    const updated = await saveRfqQuote(ref, {
      number,
      lines,
      freight: str(q.freight, 24) || undefined,
      total,
      validDays,
      notes: str(q.notes, 600) || undefined,
    });
    if (!updated) return NextResponse.json({ ok: false, error: "Unknown ref." }, { status: 404 });
    audit("ops_quote_saved");
    return NextResponse.json({ ok: true, rfq: updated });
  }

  // Path 2: lifecycle status change.
  const status = String(body.status ?? "") as RfqStatus;
  if (!RFQ_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: "Unknown ref or status." }, { status: 422 });
  }

  const updated = await updateRfqStatus(ref, status);
  if (!updated) return NextResponse.json({ ok: false, error: "Unknown ref." }, { status: 404 });

  audit("ops_status_change");
  return NextResponse.json({ ok: true, rfq: updated });
}
