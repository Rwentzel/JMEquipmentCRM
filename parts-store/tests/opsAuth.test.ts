import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { opsMode, sessionValue, verifyLoginToken, verifySession } from "../src/lib/opsAuth";

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  delete process.env.OPS_TOKEN;
  // NODE_ENV is read-only in @types/node but assignable at runtime.
  (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_ENV;
});

test("dev without OPS_TOKEN → dev-open mode, any session passes", () => {
  delete process.env.OPS_TOKEN;
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  assert.equal(opsMode(), "dev-open");
  assert.equal(verifySession(undefined), true);
});

test("production without OPS_TOKEN → console disabled", () => {
  delete process.env.OPS_TOKEN;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  assert.equal(opsMode(), "disabled");
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession("anything"), false);
});

test("token mode: only the exact token logs in", () => {
  process.env.OPS_TOKEN = "correct-horse";
  assert.equal(opsMode(), "token");
  assert.equal(verifyLoginToken("correct-horse"), true);
  assert.equal(verifyLoginToken("wrong"), false);
  assert.equal(verifyLoginToken(""), false);
});

test("token mode: session cookie must match the token digest", () => {
  process.env.OPS_TOKEN = "correct-horse";
  assert.equal(verifySession(sessionValue()), true);
  assert.equal(verifySession("deadbeef"), false);
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession(""), false);
});
