import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/agents/maintenanceAgent";
import { runSecurityScan } from "@/lib/agents/securityAgent";
import { triageRfqs } from "@/lib/agents/triageAgent";
import { audit } from "@/lib/auditLog";
import { OPS_COOKIE, verifySession } from "@/lib/opsAuth";
import { listRfqs } from "@/lib/rfqStore";

/**
 * Ops agents API — runs the built-in automation agents on demand.
 * Ops session required. Agents degrade to deterministic engines when no
 * ANTHROPIC_API_KEY is configured; no agent ever receives contact PII.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifySession((await cookies()).get(OPS_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { agent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const agent = String(body.agent ?? "");
  audit("agent_run");

  switch (agent) {
    case "triage": {
      const report = await triageRfqs(await listRfqs());
      return NextResponse.json({ ok: true, agent, report });
    }
    case "maintenance": {
      const report = await runMaintenance();
      return NextResponse.json({ ok: true, agent, report });
    }
    case "security": {
      const report = await runSecurityScan();
      return NextResponse.json({ ok: true, agent, report });
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown agent." }, { status: 422 });
  }
}
