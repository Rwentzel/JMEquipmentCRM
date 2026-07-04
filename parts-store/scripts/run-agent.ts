/**
 * Agent CLI — run the built-in automation agents outside the web app
 * (cron, CI, or a terminal):
 *
 *   npm run agent:maintenance   # catalog + store health checks
 *   npm run agent:security      # audit-log scan + posture checks
 *   npm run agent:triage        # prioritize the open RFQ queue
 *
 * Exit code is non-zero when maintenance checks fail or the security scan
 * finds a critical issue, so these slot straight into CI/monitoring.
 */

import { runMaintenance } from "../src/lib/agents/maintenanceAgent";
import { runSecurityScan } from "../src/lib/agents/securityAgent";
import { triageRfqs } from "../src/lib/agents/triageAgent";
import { listRfqs } from "../src/lib/rfqStore";

async function main() {
  const which = process.argv[2];

  switch (which) {
    case "maintenance": {
      const report = await runMaintenance();
      for (const c of report.checks) {
        console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
      }
      console.log(report.ok ? "\nAll checks passing." : "\nATTENTION: a check failed.");
      process.exitCode = report.ok ? 0 : 1;
      return;
    }
    case "security": {
      const report = await runSecurityScan();
      for (const f of report.findings) {
        console.log(`${f.severity.toUpperCase().padEnd(8)} ${f.title} — ${f.detail}`);
      }
      console.log(`\n${report.narrative}`);
      process.exitCode = report.findings.some((f) => f.severity === "critical") ? 1 : 0;
      return;
    }
    case "triage": {
      const report = await triageRfqs(await listRfqs());
      console.log(report.briefing + "\n");
      for (const t of report.queue) {
        console.log(`${t.ref}  score ${String(t.score).padStart(3)}  ${t.reasons.join("; ")}`);
      }
      return;
    }
    default:
      console.error("Usage: run-agent.ts <maintenance|security|triage>");
      process.exitCode = 2;
  }
}

void main();
