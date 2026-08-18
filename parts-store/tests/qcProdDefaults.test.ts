import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Fresh store, NO QC_DEMO_SEED: a production deployment must start with an
// empty, truthful quote book — never the handoff's fictional pipeline.
process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-qc-prod-"));
delete process.env.QC_DEMO_SEED;

import { readQcState } from "../src/lib/qc/store";

test("production default: quote book and client list start empty; catalog still seeds", async () => {
  const s = await readQcState();
  assert.equal(s.quotes.length, 0, "no demo quotes in a fresh production store");
  assert.equal(s.clients.length, 0, "no demo clients in a fresh production store");
  assert.ok(s.catalog.length >= 8, "equipment catalog is configuration and still seeds");
  assert.ok(s.settings.company, "settings defaults still seed");
});
