import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { patchQcState, readQcState, resetQcState, type QcPatch } from "@/lib/qc/store";
import type { QcState } from "@/lib/qc/types";

/**
 * Quote Center state API — INTERNAL. Full store read + segment-replace
 * writes (mirrors the prototype's commit()), behind the ops session gate.
 * Contains dealer pricing, cost/margin and client PII — never public.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  return verifySession((await cookies()).get(OPS_COOKIE)?.value);
}

export async function GET() {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });
  const state = await readQcState();
  return NextResponse.json({ ok: true, state });
}

export async function PUT(req: Request) {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 403 });
  let body: Partial<QcState> & {
    reset?: boolean;
    deleteQuoteIds?: string[];
    deleteClientIds?: string[];
    knownQuoteIds?: string[];
    knownClientIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body.reset) {
    const state = await resetQcState();
    return NextResponse.json({ ok: true, state });
  }
  const patch: QcPatch = {};
  // Deletions are stated, never inferred from an omitted record; the known
  // ids are what let the server tell a deletion from a record this client
  // simply never loaded. Both must survive the trip or the protection is
  // silently inert — which is exactly how it first shipped.
  if (Array.isArray(body.deleteQuoteIds)) patch.deleteQuoteIds = body.deleteQuoteIds.map(String);
  if (Array.isArray(body.deleteClientIds)) patch.deleteClientIds = body.deleteClientIds.map(String);
  if (Array.isArray(body.knownQuoteIds)) patch.knownQuoteIds = body.knownQuoteIds.map(String);
  if (Array.isArray(body.knownClientIds)) patch.knownClientIds = body.knownClientIds.map(String);
  if (Array.isArray(body.quotes)) patch.quotes = body.quotes;
  if (Array.isArray(body.clients)) patch.clients = body.clients;
  if (Array.isArray(body.catalog)) patch.catalog = body.catalog;
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings;
  // The authoritative post-merge state goes back to the client so it can
  // reconcile: any quote whose stored copy was newer (e.g. a customer signed
  // it while this tab was open) is reported in `conflicts` and returned as
  // the server holds it, not as the client sent it.
  const { state, conflicts } = await patchQcState(patch);
  return NextResponse.json({ ok: true, state, conflicts });
}
