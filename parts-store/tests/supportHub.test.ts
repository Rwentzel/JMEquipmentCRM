import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PANELS, KNOWN_ISSUES, isPanelKey } from "../src/components/support/panels";
import { SUPPORT_SPECS } from "../src/lib/supportRequests";

test("six panels, five of them typed, keyed by the design references' deep links", () => {
  assert.deepEqual(PANELS.map((p) => p.key), ["guides", "manual", "service", "fitment", "epc", "contact"]);
  assert.deepEqual(PANELS.map((p) => p.type), [null, "manual-request", "service-request", "fitment-check", "epc-lookup", "sales-inquiry"]);
  for (const p of PANELS) if (p.type) assert.ok(SUPPORT_SPECS[p.type], p.key);
  assert.ok(isPanelKey("manual") && !isPanelKey("nope") && !isPanelKey(null));
});

test("the known-issues board carries the pending-linkage note in gold, and no price language", () => {
  assert.equal(KNOWN_ISSUES.filter((k) => k.pending).length, 1);
  assert.match(KNOWN_ISSUES.find((k) => k.pending)!.title, /26218/);
  const text = [...PANELS, ...KNOWN_ISSUES].map((x) => JSON.stringify(x)).join(" ");
  assert.doesNotMatch(text, /\$\s?\d|\bmargin\b|\bvendor\b|\bbin\b|\bcost\b/i);
});

test("the machine platform sends 'running something else' to the manual panel", () => {
  const src = readFileSync(join(__dirname, "../src/components/machine/PlatformClient.tsx"), "utf8");
  assert.match(src, /href="\/support\?panel=manual"/);
});

test("the panel is a real modal: dialog role, labelled, Esc closes, page behind is inert", () => {
  const panel = readFileSync(join(__dirname, "../src/components/support/SupportPanel.tsx"), "utf8");
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /aria-labelledby=\{titleId\}/);
  assert.match(panel, /e\.key === "Escape"/);
  const hub = readFileSync(join(__dirname, "../src/components/support/SupportHubClient.tsx"), "utf8");
  assert.match(hub, /inert=\{open \? true : undefined\}/);
});
