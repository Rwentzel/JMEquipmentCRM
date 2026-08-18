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
  const res = await answerSupportQuestion("Is JME-VCS-0001 available?");
  assert.ok(res.skus.includes("JME-VCS-0001"));
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

/* ---- support agent: model numbers, specs, and subject-specific refusals ---- */

test("support agent recognises a machine by model number alone", async () => {
  // How customers actually ask: "the 1650", not "GMC-TCII-1650 Dual Rotary Sheeter".
  const res = await answerSupportQuestion("Do you still support the 1650?");
  assert.ok(res.skus.includes("GMC-TCII-1650"), `expected the 1650 to be matched, got ${JSON.stringify(res.skus)}`);
});

test("support agent answers a spec question with the published spec plate", async () => {
  const res = await answerSupportQuestion("What are the specs of the 1650?");
  assert.ok(res.skus.includes("GMC-TCII-1650"));
  assert.match(res.answer, /Web Width/i);
  assert.doesNotMatch(res.answer, /I can help with machine and part availability/, "must not fall through to the generic reply");
});

test("support agent does not volunteer specs when they were not asked for", async () => {
  const res = await answerSupportQuestion("Is the 1650 available?");
  assert.ok(res.skus.includes("GMC-TCII-1650"));
  assert.doesNotMatch(res.answer, /Web Width/i);
});

test("model matching does not fire on short or digitless words", async () => {
  // "50" is too short to be a model token and "sheeter" is handled by family
  // matching; neither should drag in an unrelated machine.
  const res = await answerSupportQuestion("I need 50 of something");
  assert.deepEqual(res.skus, []);
});

test("sourcing questions get a sourcing refusal, not a pricing one", async () => {
  const res = await answerSupportQuestion("Who is your supplier for bearings?");
  assert.match(res.answer, /don't discuss sourcing/i);
  assert.doesNotMatch(res.answer, /Pricing isn't published/i);
  for (const leak of [/vendor is/i, /supplied by/i, /\$\s?\d/]) assert.doesNotMatch(res.answer, leak);
});

test("sourcing questions are caught however the customer phrases them", async () => {
  // The screen keyed on the noun ("supplier") and missed the verb, so
  // "who supplies your bearings" was answered with a bearing parts listing —
  // harmless in itself, but it is the wrong answer to a boundary question.
  for (const q of [
    "who supplies your bearings",
    "who do you buy your belts from",
    "where are these sourced",
    "who is supplying the blades",
    "are these supplied by Tidland",
  ]) {
    const res = await answerSupportQuestion(q);
    assert.match(res.answer, /don't discuss sourcing/i, `not guarded: "${q}"`);
  }
});

test("the wider sourcing net does not swallow ordinary questions", async () => {
  // Broadening the screen is only safe if real customer questions still get
  // real answers — an over-eager guard is its own kind of broken.
  for (const q of [
    "What sheeters do you carry?",
    "Do you rebuild Martin rollstands?",
    "Does part 1216-8YU-30 fit a 1600-E?",
    "What is your lead time on a core splitter?",
    "How do I get a quote?",
  ]) {
    const res = await answerSupportQuestion(q);
    assert.doesNotMatch(res.answer, /don't discuss sourcing/i, `over-blocked: "${q}"`);
  }
});

test("stock-count questions get a stock refusal that explains the bands", async () => {
  const res = await answerSupportQuestion("How many do you have in stock right now?");
  assert.match(res.answer, /don't publish exact stock counts/i);
  assert.doesNotMatch(res.answer, /\b\d+\s+(units|in stock)\b/i);
});

test("pricing questions still refuse, and never emit a figure", async () => {
  for (const q of ["How much is JM108?", "What's the price of a core splitter?", "Can I get a discount?"]) {
    const res = await answerSupportQuestion(q);
    assert.match(res.answer, /Pricing isn't published/i, `for: ${q}`);
    assert.doesNotMatch(res.answer, /\$\s?\d/, `for: ${q}`);
  }
});
