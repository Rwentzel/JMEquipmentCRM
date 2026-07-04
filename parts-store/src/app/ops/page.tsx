import { cookies } from "next/headers";
import { OpsClient } from "@/components/ops/OpsClient";
import { OpsLogin } from "@/components/ops/OpsLogin";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";

/**
 * Ops desk — internal console for the parts team.
 *
 * Gate order: disabled (production without OPS_TOKEN) → login (token mode,
 * no valid session) → console. The console is the only UI with access to
 * stored RFQs; see opsAuth.ts for the security model.
 */

export const dynamic = "force-dynamic";

export default function OpsPage() {
  const mode = opsMode();

  if (mode === "disabled") {
    return (
      <main className="ops-gate">
        <h1>Ops desk is disabled</h1>
        <p>
          Set the <code>OPS_TOKEN</code> environment variable to enable the internal console. Tokens are never stored
          in the repository.
        </p>
      </main>
    );
  }

  const authed = verifySession(cookies().get(OPS_COOKIE)?.value);
  if (!authed) return <OpsLogin />;

  return <OpsClient devOpen={mode === "dev-open"} />;
}
