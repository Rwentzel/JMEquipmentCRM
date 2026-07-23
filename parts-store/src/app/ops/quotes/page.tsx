import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OpsLogin } from "@/components/ops/OpsLogin";
import { QuoteCenterClient } from "@/components/qc/QuoteCenterClient";
import { OPS_COOKIE, opsMode, verifySession } from "@/lib/opsAuth";

/** Quote Center — internal quoting suite. Same gate as the ops desk. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quote Center",
  robots: { index: false, follow: false },
};

export default async function QuoteCenterPage() {
  const mode = opsMode();
  if (mode === "disabled") {
    return (
      <main className="ops-gate">
        <h1>Quote Center is disabled</h1>
        <p>Set the <code>OPS_TOKEN</code> environment variable to enable internal tools.</p>
      </main>
    );
  }
  const authed = verifySession((await cookies()).get(OPS_COOKIE)?.value);
  if (!authed) return <OpsLogin />;
  return <QuoteCenterClient />;
}
