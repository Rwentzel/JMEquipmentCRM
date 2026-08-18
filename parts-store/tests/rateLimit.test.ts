import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, rateLimit, trackedKeys } from "../src/lib/rateLimit";

function headers(h: Record<string, string>) {
  return { headers: { get: (n: string) => h[n.toLowerCase()] ?? null } };
}

test("the limit holds for a steady caller", () => {
  const k = `steady-${Math.random()}`;
  const results = Array.from({ length: 7 }, () => rateLimit(k, 5, 60_000).ok);
  assert.deepEqual(results, [true, true, true, true, true, false, false]);
});

test("a fresh window lets the caller back in", async () => {
  const k = `window-${Math.random()}`;
  for (let i = 0; i < 5; i++) rateLimit(k, 5, 5);
  assert.equal(rateLimit(k, 5, 5).ok, false, "should be blocked inside the window");
  // Wait past resetAt rather than assuming the priming calls straddled a
  // millisecond boundary — they do not; they all land in the same tick.
  await new Promise((r) => setTimeout(r, 12));
  assert.equal(rateLimit(k, 5, 60_000).ok, true);
});

test("tracked keys are capped, and capping them stays cheap", () => {
  // Buckets were never evicted, so a rotated header grew the map for the life
  // of the process: 500k unique keys measured 147 MB of heap that nothing
  // released, on a deployment the runbook specifies as a single small
  // instance. The elapsed-time assertion guards the first attempt at fixing
  // that, which evicted to exactly the cap and sorted the whole map on every
  // insert — trading a memory problem for a CPU one.
  const started = Date.now();
  for (let i = 0; i < 120_000; i++) rateLimit(`flood-${i}-${started}`, 5, 60_000);
  assert.ok(trackedKeys() <= 20_000, `tracked ${trackedKeys()} keys — eviction is not running`);
  assert.ok(Date.now() - started < 20_000, `120k inserts took ${Date.now() - started} ms — eviction is not amortised`);
});

test("a caller under the cap keeps their window across an unrelated flood", () => {
  // Eviction takes the oldest first, so a bucket created after the flood
  // started must survive it.
  const k = `survivor-${Math.random()}`;
  for (let i = 0; i < 3; i++) rateLimit(k, 5, 60_000);
  for (let i = 0; i < 5_000; i++) rateLimit(`noise-${i}-${Math.random()}`, 5, 60_000);
  assert.equal(rateLimit(k, 5, 60_000).ok, true);
  assert.equal(rateLimit(k, 5, 60_000).ok, true);
  assert.equal(rateLimit(k, 5, 60_000).ok, false, "the survivor's count should have carried through");
});

test("a proxy-set client header is preferred over anything the client sent", () => {
  // X-Forwarded-For's FIRST entry is the one value in the chain the client
  // fully controls. Taking it let a rotated header defeat the limit outright.
  assert.equal(
    clientKey(headers({ "fly-client-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 203.0.113.9" })),
    "203.0.113.9",
  );
  assert.equal(clientKey(headers({ "cf-connecting-ip": "203.0.113.9" })), "203.0.113.9");
  assert.equal(clientKey(headers({ "true-client-ip": "203.0.113.9" })), "203.0.113.9");
  assert.equal(clientKey(headers({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
});

test("falling back to X-Forwarded-For takes the hop our own proxy appended", () => {
  assert.equal(clientKey(headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.7, 203.0.113.9" })), "203.0.113.9");
  assert.equal(clientKey(headers({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  assert.equal(clientKey(headers({ "x-forwarded-for": "  ,  203.0.113.9  " })), "203.0.113.9");
});

test("a caller spoofing the leading hop no longer gets a fresh allowance", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    seen.add(clientKey(headers({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.42` })));
  }
  assert.deepEqual([...seen], ["203.0.113.42"], "rotating the leading hop still splits the bucket");
});

test("no usable header at all degrades to a single local bucket", () => {
  assert.equal(clientKey(headers({})), "local");
  assert.equal(clientKey(headers({ "x-forwarded-for": "" })), "local");
});
