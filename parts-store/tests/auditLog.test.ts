import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { appendFile, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-audit-test-"));
const DIR = process.env.RFQ_DATA_DIR;
const LOG = path.join(DIR, "audit.jsonl");
const ROLLED = `${LOG}.1`;

import { audit, recentEvents } from "../src/lib/auditLog";

/**
 * The append is fire-and-forget, so poll for the effect rather than sleeping a
 * fixed amount — a hard-coded wait is exactly the kind of test that passes on a
 * quiet machine and fails in CI.
 */
async function settleUntil(check: () => Promise<boolean>, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check().catch(() => false)) return;
    if (Date.now() > deadline) return;
    await new Promise((r) => setTimeout(r, 25));
  }
}
const fileExists = (f: string) => stat(f).then(() => true, () => false);

function line(i: number): string {
  return JSON.stringify({ kind: "assistant_query", ts: new Date(2026, 0, 1, 0, 0, i % 60).toISOString(), n: i }) + "\n";
}

test("events reach the log and come back newest-last", async () => {
  audit("ops_login_ok");
  audit("quote_accepted", { n: 3 });
  await settleUntil(async () => (await recentEvents(10)).some((e) => e.kind === "quote_accepted"));
  const events = await recentEvents(10);
  assert.equal(events.at(-1)?.kind, "quote_accepted");
  assert.equal(events.at(-1)?.n, 3);
});

test("no user-supplied string can enter the log", async () => {
  // The whole reason this log is safe to hand to an agent or to monitoring.
  audit("quote_invalid", { keyHash: "abc123def456" });
  await settleUntil(async () => (await readFile(LOG, "utf8")).includes("abc123def456"));
  const raw = await readFile(LOG, "utf8");
  for (const key of Object.keys(JSON.parse(raw.trim().split("\n").at(-1)!))) {
    assert.ok(["kind", "ts", "n", "keyHash"].includes(key), `unexpected field in an audit event: ${key}`);
  }
});

test("reading the recent tail does not depend on the size of the history", async () => {
  // A year of traffic used to be read and parsed in full to answer "the last
  // 500": measured at 865 ms and 268 MB of heap for a 56 MB file.
  await writeFile(LOG, "");
  const bulk: string[] = [];
  for (let i = 0; i < 200_000; i++) bulk.push(line(i));
  await appendFile(LOG, bulk.join(""));
  const size = (await stat(LOG)).size;
  assert.ok(size > 8 * 1024 * 1024, "fixture should be large enough to matter");

  const before = process.memoryUsage().heapUsed;
  const started = Date.now();
  const events = await recentEvents(500);
  const heapMb = (process.memoryUsage().heapUsed - before) / 1024 / 1024;

  assert.equal(events.length, 500);
  assert.equal(events.at(-1)?.n, 199_999, "the newest event is the last one written");
  assert.ok(Date.now() - started < 500, `tail read took ${Date.now() - started} ms`);
  assert.ok(heapMb < 40, `tail read allocated ${heapMb.toFixed(1)} MB`);
});

test("the log rotates instead of growing without bound", async () => {
  await writeFile(LOG, "");
  const bulk: string[] = [];
  for (let i = 0; i < 200_000; i++) bulk.push(line(i));
  await appendFile(LOG, bulk.join(""));
  assert.ok((await stat(LOG)).size > 8 * 1024 * 1024);

  audit("agent_run");
  await settleUntil(() => fileExists(ROLLED));

  // Rotation renames the live file away; the next append recreates it, so
  // "gone or small" is the honest assertion here.
  const liveSize = await stat(LOG).then((st) => st.size, () => 0);
  assert.ok(liveSize < 1024, `live log should be empty or absent after rotation, was ${liveSize} bytes`);
  assert.ok((await stat(ROLLED)).size > 8 * 1024 * 1024, "the previous generation is kept, not deleted");

  // And the desk can still read across the rotation.
  const events = await recentEvents(20);
  assert.ok(events.length > 0, "history is still readable immediately after a rotation");
});

test("history survives a rotation, so the desk does not appear to lose it", async () => {
  await writeFile(ROLLED, [line(1), line(2), line(3)].join(""));
  await writeFile(LOG, line(4));
  const events = await recentEvents(500);
  const ns = events.map((e) => e.n);
  assert.deepEqual(ns.slice(-4), [1, 2, 3, 4], "the rolled generation is read before the live one");
});

test("a truncated first line in the tail is discarded, not mis-parsed", async () => {
  await writeFile(LOG, "");
  const bulk: string[] = [];
  for (let i = 0; i < 20_000; i++) bulk.push(line(i));
  // A deliberately corrupt fragment at the very front, as a partial write leaves.
  await appendFile(LOG, `{"kind":"trunc` + "\n" + bulk.join(""));
  const events = await recentEvents(50);
  assert.equal(events.length, 50);
  assert.ok(events.every((e) => e.kind === "assistant_query"));
});
