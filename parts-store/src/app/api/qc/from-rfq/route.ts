import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";
import { quoteFromRfq } from "@/lib/qc/fromRfq";
import { patchQcState, readQcState } from "@/lib/qc/store";
import { getRfq, updateRfqStatus } from "@/lib/rfqStore";

/**
 * Turn a storefront RFQ into a draft quote — INTERNAL, ops-gated.
 *
 * Auth, fetch, persist. The conversion itself is `quoteFromRfq`, which is a
 * pure function so it can be tested against directly rather than mirrored in a
 * test helper that drifts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (opsMode() === "disabled") return NextResponse.json({ ok: false }, { status: 403 });
  if (opsMode() !== "dev-open" && !verifySession((await cookies()).get(OPS_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { ref?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ref = String(body.ref ?? "").trim();
  if (!ref) return NextResponse.json({ ok: false }, { status: 400 });

  const rfq = await getRfq(ref);
  if (!rfq) return NextResponse.json({ ok: false, error: "Unknown request" }, { status: 404 });

  const state = await readQcState();
  const q = quoteFromRfq(rfq, state.catalog, state.settings, state.quotes.length);

  await patchQcState({ quotes: [q, ...state.quotes] });
  await updateRfqStatus(ref, "quoted");
  audit("qc_change", { n: 1 });

  return NextResponse.json({ ok: true, id: q.id, number: q.number });
}
