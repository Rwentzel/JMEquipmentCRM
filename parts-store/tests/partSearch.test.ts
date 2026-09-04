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
    const hay = [p.sku, p.name, p.cat, p.category, p.fitment, p.description, ...(p.keywords ?? [])].join(" ").toLowerCase();
    assert.ok(hay.includes("belt") && hay.includes("slitter"), `${p.sku} matched without both words`);
  }
});

test("the machine family is searchable — a customer types the family before the part", () => {
  // 99% of the catalogue carries its family in `cat` ("Sheeter", "Brakes")
  // with no fine-grained `category`, and the haystack read `category` only. So
  // "sheeter" found 4 of 1,930 sheeter parts and "sheeter belt" found none,
  // though the category rail groups every one of them under Sheeter. A
  // customer arriving from an email signature types the family first.
  for (const [word, catName] of [["sheeter", "Sheeter"], ["brakes", "Brakes"], ["rollstand", "Rollstand"]]) {
    const inCat = catalog.parts.filter((p) => p.cat === catName);
    if (inCat.length === 0) continue;
    const missed = inCat.filter((p) => find(word).every((f) => f.sku !== p.sku));
    assert.equal(missed.length, 0, `${missed.length} '${catName}' parts are not found by '${word}'`);
  }
  // …and the family still narrows with a second word (AND across cat + name).
  const belts = find("sheeter belt");
  assert.ok(belts.length > 5, `'sheeter belt' should list the sheeter belts, got ${belts.length}`);
  assert.ok(belts.every((p) => p.cat === "Sheeter"), "every hit is a sheeter part");
  assert.ok(belts.some((p) => /belt/i.test(p.name)), "and a belt");
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

import { highlightRanges } from "../src/lib/partSearch";

test("highlight marks every token where it occurs, in order, case-insensitively", () => {
  const text = "Belt for Bottom slitter drive";
  assert.deepEqual(highlightRanges(text, queryTokens("slitter bottom")), [[9, 15], [16, 23]]);
  assert.deepEqual(highlightRanges(text, queryTokens("BELT DRIVE")), [[0, 4], [24, 29]]);
});

test("highlight merges overlapping and touching ranges into one mark", () => {
  assert.deepEqual(highlightRanges("slitter", queryTokens("slit slitter")), [[0, 7]], "overlapping");
  assert.deepEqual(highlightRanges("beltbelt", queryTokens("belt")), [[0, 8]], "touching");
  // Separated by a space they are NOT touching, and must stay two marks —
  // marking the space between two words would read as one wrong word.
  assert.deepEqual(highlightRanges("bottom slitter", queryTokens("bottom slitter")), [[0, 6], [7, 14]]);
});

test("highlight marks repeated occurrences and nothing for an absent token", () => {
  assert.deepEqual(highlightRanges("belt belt", queryTokens("belt")), [[0, 4], [5, 9]]);
  assert.deepEqual(highlightRanges("Belt for Bottom slitter drive", queryTokens("JMESHT0096")), []);
  assert.deepEqual(highlightRanges("anything", []), []);
});

test("highlight ranges always cover exactly the query tokens' text", () => {
  const text = "Tidland Diaphragm Kit Model 50 (Dia/PstAsm/RetPlt/Bolt)";
  for (const [s, e] of highlightRanges(text, queryTokens("diaphragm kit dia"))) {
    const piece = text.slice(s, e).toLowerCase();
    assert.ok(["diaphragm", "kit", "dia"].some((t) => piece.includes(t)), `"${piece}" is not a token`);
  }
});
