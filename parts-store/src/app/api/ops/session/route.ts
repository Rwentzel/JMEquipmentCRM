import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit, hashKey } from "@/lib/auditLog";
import { OPS_COOKIE, opsMode, sessionValue, verifyLoginToken } from "@/lib/opsAuth";
import { rateLimit } from "@/lib/rateLimit";

/** Ops login/logout. Sets an httpOnly session cookie; never echoes the token. */

export const runtime = "nodejs";

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  const key = clientKey(req);
  // Tight limit — this is a credential endpoint.
  const rl = rateLimit(`ops-login:${key}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
  }

  if (opsMode() !== "token") {
    return NextResponse.json({ ok: false, error: "Ops console is not enabled." }, { status: 403 });
  }

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  if (!token || !verifyLoginToken(token)) {
    audit("ops_login_fail", { keyHash: hashKey(key) });
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });
  }

  audit("ops_login_ok");
  cookies().set(OPS_COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h shift
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  cookies().delete(OPS_COOKIE);
  return NextResponse.json({ ok: true });
}
