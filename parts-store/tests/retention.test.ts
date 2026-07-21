import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.RFQ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "jme-retention-test-"));

import { saveRfq, listRfqs, updateRfqStatus, sweepRetention } from "../src/lib/rfqStore";

const input = {
  contact: { company: "Acme", name: "Pat", email: "pat@acme.com" },
  items: [{ sku: "JME-VCS-0001", qty: 1 }],
  freight: false,
};

function backdate(iso: string, ref: string) {
  // Age a record on disk directly — the store trusts its own file.
  const file = path.join(process.env.RFQ_DATA_DIR!, "rfqs.json");
  const all = JSON.parse(readFileSync(file, "utf8"));
  const rfq = all.find((r: { ref: string }) => r.ref === ref);
  rfq.updatedAt = iso;
  require("node:fs").writeFileSync(file, JSON.stringify(all));
}

test("retention archives only old, closed RFQs; open work is never purged", async () => {
  const oldWon = await saveRfq(input);
  await updateRfqStatus(oldWon.ref, "won");
  const oldOpen = await saveRfq(input); // stays "new"
  const freshWon = await saveRfq(input);
  await updateRfqStatus(freshWon.ref, "won");

  const threeYearsAgo = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString();
  backdate(threeYearsAgo, oldWon.ref);
  backdate(threeYearsAgo, oldOpen.ref);

  // Dry run: reports but does not modify
  const dry = await sweepRetention(730, false);
  assert.equal(dry.archived, 1, "only the old WON record is expired");
  assert.equal(dry.archiveFile, null);
  assert.equal((await listRfqs()).length, 3, "dry run leaves the store intact");

  // Apply: old won archived to file, old open + fresh won kept
  const applied = await sweepRetention(730, true);
  assert.equal(applied.archived, 1);
  assert.ok(applied.archiveFile);
  const archived = JSON.parse(readFileSync(applied.archiveFile!, "utf8"));
  assert.equal(archived[0].ref, oldWon.ref);
  const remaining = await listRfqs();
  assert.deepEqual(new Set(remaining.map((r) => r.ref)), new Set([oldOpen.ref, freshWon.ref]));
});

test("retention rejects nothing when everything is fresh", async () => {
  const res = await sweepRetention(730, true);
  assert.equal(res.archived, 0);
});
