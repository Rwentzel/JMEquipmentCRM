import assert from "node:assert/strict";
import test from "node:test";
import { parseMoney, pipelineStats } from "../src/lib/pipeline";

test("parseMoney handles currency strings and rejects non-numbers", () => {
  assert.equal(parseMoney("$1,480.00"), 1480);
  assert.equal(parseMoney("RFQ"), null);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(undefined), null);
});

test("pipelineStats weights open stages and books won revenue", () => {
  const s = pipelineStats([
    { status: "quoted", total: "$100,000" },
    { status: "reviewing", total: "$40,000" },
    { status: "new" },
    { status: "won", total: "$18,300" },
    { status: "lost", total: "$9,000" },
    { status: "archived", total: "$1" },
  ]);
  assert.equal(s.openCount, 3);
  assert.equal(s.openValue, 140000);
  assert.equal(s.weightedForecast, 65000);
  assert.equal(s.wonValue, 18300);
  assert.equal(s.winRate, 50);
});
