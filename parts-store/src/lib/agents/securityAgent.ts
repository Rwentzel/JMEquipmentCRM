/**
 * Security agent — abuse detection over the (PII-free) audit log plus a
 * static posture checklist. Deterministic thresholds always run; an optional
 * LLM narrative summarizes findings when a key is configured. The audit log
 * contains no PII by construction, so feeding it to the LLM is safe.
 */

import { recentEvents, type AuditEvent } from "@/lib/auditLog";
import { aiAvailable, complete } from "@/lib/ai/provider";

export type Severity = "info" | "warn" | "critical";

export interface SecurityFinding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface SecurityReport {
  findings: SecurityFinding[];
  narrative: string;
  engine: "ai" | "rules";
  ranAt: string;
}

const DAY_MS = 86_400_000;

/** Threshold analysis over recent audit events. Pure and unit-testable. */
export function analyzeEvents(events: AuditEvent[], now: Date): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const dayAgo = now.getTime() - DAY_MS;
  const recent = events.filter((e) => Date.parse(e.ts) >= dayAgo);

  const count = (kind: AuditEvent["kind"]) => recent.filter((e) => e.kind === kind).length;

  const honeypot = count("quote_honeypot");
  if (honeypot >= 10) {
    findings.push({
      severity: "warn",
      title: "Sustained bot pressure on the quote form",
      detail: `${honeypot} honeypot hits in 24h. The form is holding, but consider edge-level bot filtering before launch.`,
    });
  } else if (honeypot > 0) {
    findings.push({
      severity: "info",
      title: "Honeypot absorbing bot submissions",
      detail: `${honeypot} honeypot hit${honeypot === 1 ? "" : "s"} in 24h — silently discarded as designed.`,
    });
  }

  const limited = count("quote_rate_limited") + count("assistant_rate_limited");
  if (limited >= 20) {
    findings.push({
      severity: "warn",
      title: "Heavy rate limiting",
      detail: `${limited} requests rate-limited in 24h. Review the hashed client keys in the audit log for a single-source flood.`,
    });
  }

  const invalid = count("quote_invalid");
  const accepted = count("quote_accepted");
  if (invalid >= 15 && invalid > accepted * 3) {
    findings.push({
      severity: "warn",
      title: "High invalid-submission ratio",
      detail: `${invalid} invalid vs ${accepted} accepted in 24h — probing or a broken client. Check for a form regression first.`,
    });
  }

  const loginFails = count("ops_login_fail");
  if (loginFails >= 5) {
    findings.push({
      severity: "critical",
      title: "Repeated ops-console login failures",
      detail: `${loginFails} failed ops logins in 24h. Rotate OPS_TOKEN and review access.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      title: "No abuse signals",
      detail: `${recent.length} audit events in 24h, all within normal thresholds.`,
    });
  }
  return findings;
}

/** Static posture checks — configuration that should be true in this build. */
export function postureChecks(): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  findings.push(
    process.env.OPS_TOKEN
      ? { severity: "info", title: "Ops console token set", detail: "OPS_TOKEN is configured via environment." }
      : {
          severity: process.env.NODE_ENV === "production" ? "critical" : "warn",
          title: "Ops console token not set",
          detail:
            "OPS_TOKEN is unset. In production the ops console is disabled without it; set it via the environment (never in the repo).",
        },
  );

  findings.push(
    process.env.ANTHROPIC_API_KEY
      ? { severity: "info", title: "AI provider configured", detail: "Agents use the Anthropic API via environment key." }
      : { severity: "info", title: "AI provider offline", detail: "No ANTHROPIC_API_KEY — agents run on deterministic rules engines (fully functional)." },
  );

  return findings;
}

export async function runSecurityScan(now = new Date()): Promise<SecurityReport> {
  const events = await recentEvents(1000);
  const findings = [...analyzeEvents(events, now), ...postureChecks()];

  const worst = findings.some((f) => f.severity === "critical")
    ? "critical"
    : findings.some((f) => f.severity === "warn")
      ? "warn"
      : "info";
  let narrative = `Scan complete: ${findings.length} finding${findings.length === 1 ? "" : "s"}, worst severity ${worst}.`;
  let engine: "ai" | "rules" = "rules";

  if (aiAvailable()) {
    const text = await complete({
      system:
        "You are a security analyst summarizing automated findings for an industrial parts storefront. Write 2-3 plain sentences: overall posture, the single most important action, and anything that can wait. No markdown.",
      user: JSON.stringify(findings),
      maxTokens: 250,
    });
    if (text) {
      narrative = text;
      engine = "ai";
    }
  }

  return { findings, narrative, engine, ranAt: now.toISOString() };
}
