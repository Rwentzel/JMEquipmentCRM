import { test } from "node:test";
import assert from "node:assert/strict";
import { compactSku, partMatches, queryTokens } from "../src/lib/partSearch";
import { catalog } from "../src/data/catalog";

const find = (q: string) => catalog.parts.filter((p) => partMatches(p, queryTokens(q)));
const has = (q: string, sku: string) => find(q).some((p) => p.sku === sku);

// Real part, real name: JME-SHT-0096 "Belt for Bottom slitter drive".
const TARGET = "JME-SHT-0096";

test("the cases that returned nothing before: words out of order, non-adjacent, SKU without punctuation", () => {
  assert.ok(has("slitter bottom", TARGET), "words out of order");
  assert.ok(has("belt slitter", TARGET), "words from the name that are not adjacent");
  assert.ok(has("JMESHT0096", TARGET), "part number typed without hyphens");
  assert.ok(has("jmesht0096", TARGET), "…and lowercase");
});

test("everything that worked before still works", () => {
  for (const q of [TARGET, TARGET.toLowerCase(), "SHT-0096", "0096", `${TARGET} `, "bottom slitter", "diaphragm kit"]) {
    assert.ok(find(q).length >= 1, `"${q}" should still match`);
  }
  assert.deepEqual(find(TARGET).map((p) => p.sku), [TARGET], "an exact SKU is still a single, exact hit");
});

test("every token must match — a two-word query is narrower than either word alone", () => {
  const belt = find("belt").length, slitter = find("slitter").length, both = find("belt slitter").length;
  assert.ok(both >= 1);
  assert.ok(both < belt && both < slitter, `AND semantics: ${both} should be below ${belt} and ${slitter}`);
  for (const p of find("belt slitter")) {
    const hay = [p.sku, p.name, p.category, p.fitment, p.description, ...(p.keywords ?? [])].join(" ").toLowerCase();
    assert.ok(hay.includes("belt") && hay.includes("slitter"), `${p.sku} matched without both words`);
  }
});

test("no fuzzy matching: a typo returns nothing rather than a plausible wrong part", () => {
  assert.equal(find("slittre").length, 0);
});

test("compacted SKU matching does not over-match on digits alone", () => {
  // "0096" already matches by plain substring; compacting must not make a
  // bare number hit every SKU that merely contains those digits split apart.
  assert.ok(find("0096").every((p) => compactSku(p.sku).includes("0096") || p.name.toLowerCase().includes("0096")));
});

test("query tokenising is whitespace-tolerant and lowercases", () => {
  assert.deepEqual(queryTokens("  Belt   Slitter "), ["belt", "slitter"]);
  assert.deepEqual(queryTokens(""), []);
  assert.deepEqual(queryTokens("   "), []);
});

test("an empty query matches the whole catalogue", () => {
  assert.equal(find("").length, catalog.parts.length);
});
