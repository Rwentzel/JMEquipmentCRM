import { test } from "node:test";
import assert from "node:assert/strict";
import { answerSupportQuestion } from "../src/lib/agents/supportAgent";
import { scoreRfq } from "../src/lib/agents/triageAgent";
import { catalogChecks } from "../src/lib/agents/maintenanceAgent";
import { analyzeEvents } from "../src/lib/agents/securityAgent";
import type { StoredRfq } from "../src/lib/rfqStore";
import type { AuditEvent } from "../src/lib/auditLog";

// No ANTHROPIC_API_KEY in tests → every agent must run on its rules engine.
delete process.env.ANTHROPIC_API_KEY;

/* ---- support agent ---- */

test("support agent refuses pricing questions and never emits a price", async () => {
  const res = await answerSupportQuestion("How much does the JM108 knife bearing cost?");
  assert.equal(res.engine, "rules");
  assert.doesNotMatch(res.answer, /\$\s?\d/);
  assert.match(res.answer, /quote|written/i);
});

test("support agent refuses exact-quantity questions", async () => {
  const res = await answerSupportQuestion("How many units in stock do you have?");
  assert.doesNotMatch(res.answer, /\d+ (units|on hand)/i);
  assert.match(res.answer, /written/i);
});

test("support agent answers catalog availability as status bands", async () => {
  const res = await answerSupportQuestion("Is JM108 available?");
  assert.ok(res.skus.includes("JM108"));
  assert.match(res.answer, /availability: /);
});

test("support agent falls back to FAQ knowledge", async () => {
  const res = await answerSupportQuestion("Do you handle freight for heavy machines?");
  assert.match(res.answer, /freight/i);
});

/* ---- triage agent ---- */

function rfq(over: Partial<StoredRfq>): StoredRfq {
  return {
    ref: "RFQ-TEST0001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "new",
    contact: { company: "X", name: "Y", email: "z@x.com" },
    items: [{ sku: "JM108", qty: 1 }],
    freight: false,
    ...over,
  };
}

test("triage scores aged freight requests above fresh simple ones", () => {
  const now = new Date();
  const aged = scoreRfq(
    rfq({ ref: "RFQ-AGED0001", createdAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(), freight: true }),
    now,
  );
  const fresh = scoreRfq(rfq({ ref: "RFQ-FRESH001" }), now);
  assert.ok(aged.score > fresh.score);
  assert.ok(aged.reasons.some((r) => r.includes("SLA")));
});

test("triage flags large orders", () => {
  const big = scoreRfq(rfq({ items: [{ sku: "JM108", qty: 12 }] }), new Date());
  assert.ok(big.reasons.some((r) => r.includes("large order")));
});

/* ---- maintenance agent ---- */

test("catalog health checks all pass on the shipped catalog", () => {
  const checks = catalogChecks();
  for (const c of checks) assert.ok(c.ok, `${c.name}: ${c.detail}`);
});

/* ---- security agent ---- */

function ev(kind: AuditEvent["kind"], minsAgo: number): AuditEvent {
  return { kind, ts: new Date(Date.now() - minsAgo * 60_000).toISOString() };
}

test("security agent reports calm when nothing is wrong", () => {
  const findings = analyzeEvents([ev("quote_accepted", 5)], new Date());
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.severity, "info");
});

test("security agent escalates repeated ops login failures to critical", () => {
  const events = Array.from({ length: 6 }, (_, i) => ev("ops_login_fail", i));
  const findings = analyzeEvents(events, new Date());
  assert.ok(findings.some((f) => f.severity === "critical"));
});

test("security agent warns on sustained honeypot pressure", () => {
  const events = Array.from({ length: 12 }, (_, i) => ev("quote_honeypot", i));
  const findings = analyzeEvents(events, new Date());
  assert.ok(findings.some((f) => f.severity === "warn" && /bot/i.test(f.title)));
});

test("security agent ignores events older than 24h", () => {
  const events = Array.from({ length: 12 }, () => ev("quote_honeypot", 60 * 30));
  const findings = analyzeEvents(events, new Date());
  assert.ok(findings.every((f) => f.severity === "info"));
});
