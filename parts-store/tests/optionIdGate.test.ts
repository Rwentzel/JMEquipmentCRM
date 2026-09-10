/**
 * Option-id gate (owner ruling 2026-09-10).
 *
 * Configurator choices carry an INTERNAL id, never a coined part number. The
 * id may travel browser → intake and be stored beside the resolved labels,
 * but it must never render on a customer surface or reach a desk surface.
 * tests/provenance.test.ts checks the ids collide with no real part number
 * and never leak into a resolved line. This gate covers the surfaces beyond
 * that: every desk surface, the customer components' source, and — via the
 * smoke flow "configurator ids never reach a screen or the desk" — the live
 * storefront, the machine page and the ops inbox.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { details } from "../src/data/details";
import { configLines } from "../src/lib/rfqConfig";
import { formatRfqEmail } from "../src/lib/mail";
import { rfqsToCsv } from "../src/lib/csv";
import { quoteFromRfq } from "../src/lib/qc/fromRfq";
import { qcDefaults, SEED_CATALOG } from "../src/lib/qc/data";
import type { StoredRfq } from "../src/lib/rfqStore";

const ALL_IDS: { machine: string; option: string; id: string; label: string }[] = [];
for (const [machine, d] of Object.entries(details)) {
  for (const opt of d.options) for (const c of opt.choices) ALL_IDS.push({ machine, option: opt.id, id: c.id, label: c.v });
}

/** A bare id as its own token — not inside a longer word or number. */
const bare = (id: string) => new RegExp(`(^|[^A-Za-z0-9])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`);

test("every configurator choice has an id, unique within its option, distinct from its label", () => {
  // Collisions with real part numbers are covered by tests/provenance.test.ts.
  assert.ok(ALL_IDS.length >= 50, "sanity: the configurators are populated");
  for (const [machine, d] of Object.entries(details)) {
    for (const opt of d.options) {
      const ids = opt.choices.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `${machine}/${opt.id}: duplicate ids`);
      for (const c of opt.choices) {
        assert.ok(c.id.trim().length > 0, `${machine}/${opt.id}: empty id`);
        assert.notEqual(c.id, c.v, `${machine}/${opt.id}: id must not double as the label`);
      }
    }
  }
});

test("labels resolve from ids on the server; an id never survives into the resolved lines", () => {
  for (const { machine, id, label } of ALL_IDS) {
    const lines = configLines(machine, [id]);
    assert.equal(lines.length, 1, `${machine}: ${id} did not resolve`);
    assert.ok(lines[0]!.endsWith(label), `${machine}: ${id} resolved to ${lines[0]}`);
    assert.doesNotMatch(lines[0]!, bare(id), `${machine}: id ${id} leaked into "${lines[0]}"`);
  }
});

/** A stored request built the way the intake stores it: labels in `config`, ids in `optionIds`. */
function configuredRfq(): StoredRfq {
  const machine = "JME-VCS12-75";
  const d = details[machine]!;
  const picks = d.options.map((o) => o.choices[o.choices.length - 1]!.id);
  return {
    ref: "RFQ-GATE0001",
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    status: "new",
    contact: { company: "Gate Co", name: "Pat", email: "pat@example.com" },
    items: [{ sku: machine, qty: 1, config: configLines(machine, picks), optionIds: picks }],
    freight: true,
  };
}

test("desk surfaces carry the resolved labels and never a bare id: email, CSV, quote conversion", () => {
  const rfq = configuredRfq();
  const ids = rfq.items[0]!.optionIds!;
  assert.ok(ids.length >= 3, "sanity: several options chosen");
  const email = formatRfqEmail(rfq).text;
  const csv = rfqsToCsv([rfq]);
  const q = quoteFromRfq(rfq, SEED_CATALOG, qcDefaults(), 0);
  const quoteText = JSON.stringify(q);
  for (const line of rfq.items[0]!.config!) {
    assert.ok(email.includes(line), `email lacks "${line}"`);
    assert.ok(csv.includes(line), `csv lacks "${line}"`);
  }
  for (const id of ids) {
    assert.doesNotMatch(email, bare(id), `email carries bare id ${id}`);
    assert.doesNotMatch(csv, bare(id), `csv carries bare id ${id}`);
    assert.doesNotMatch(quoteText, bare(id), `quote conversion carries bare id ${id}`);
  }
});

test("customer components never render a choice id as text", () => {
  const files = [
    "src/components/machine/MachineDetailClient.tsx",
    "src/app/page.tsx",
    "src/components/ReorderPanel.tsx",
    "src/components/machine/CompareClient.tsx",
    "src/components/machine/MachinePlatformClient.tsx",
    "src/components/qc/QuoteDoc.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(join(__dirname, "..", f), "utf8");
    // `{c.id}` / `{choice.id}` as a JSX text child, or as a template piece inside text.
    assert.doesNotMatch(src, />\s*\{[^}]*\b(c|ch|choice)\.id\b[^}]*\}\s*</, `${f} renders a choice id`);
    assert.doesNotMatch(src, /configLabel[^;\n]*\.id\b/, `${f} builds the display label from an id`);
  }
  const detail = readFileSync(join(__dirname, "../src/components/machine/MachineDetailClient.tsx"), "utf8");
  assert.match(detail, /configLabel: selection\.join/, "the display label is built from the picked labels");
  assert.match(detail, /options: selectedOptionSkus|options: selectedOptionIds/, "ids travel in options[] for the server to resolve");
});
