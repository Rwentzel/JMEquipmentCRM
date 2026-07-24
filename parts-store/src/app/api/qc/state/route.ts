import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { patchQcState, readQcState, resetQcState } from "@/lib/qc/store";
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
  let body: Partial<QcState> & { reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body.reset) {
    const state = await resetQcState();
    return NextResponse.json({ ok: true, state });
  }
  const patch: Partial<QcState> = {};
  if (Array.isArray(body.quotes)) patch.quotes = body.quotes;
  if (Array.isArray(body.clients)) patch.clients = body.clients;
  if (Array.isArray(body.catalog)) patch.catalog = body.catalog;
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings;
  const state = await patchQcState(patch);
  return NextResponse.json({ ok: true, state });
}
