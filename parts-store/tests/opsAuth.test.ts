import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SESSION_TTL_SECONDS, issueSession, opsMode, verifyLoginToken, verifySession } from "../src/lib/opsAuth";

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

test("token mode: only a session this server signed is accepted", () => {
  process.env.OPS_TOKEN = "correct-horse";
  assert.equal(verifySession(issueSession()), true);
  assert.equal(verifySession("deadbeef"), false);
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession(""), false);
  // Shaped like a session, but not signed with this token.
  assert.equal(verifySession("9999999999.abc.0000"), false);
});

test("a session expires server-side, not merely in the browser", () => {
  // The old cookie was a bare digest of the token: identical for every login
  // and valid forever, so Max-Age was only ever a hint the browser could be
  // told to ignore. A captured cookie stayed good until the token rotated.
  process.env.OPS_TOKEN = "correct-horse";
  const now = Date.UTC(2026, 0, 1, 9, 0, 0);
  const session = issueSession(now);

  assert.equal(verifySession(session, now + 1000), true, "valid at the start of the shift");
  assert.equal(
    verifySession(session, now + (SESSION_TTL_SECONDS - 60) * 1000),
    true,
    "still valid just before it lapses",
  );
  assert.equal(
    verifySession(session, now + (SESSION_TTL_SECONDS + 1) * 1000),
    false,
    "rejected once past its expiry, however the cookie reached us",
  );
});

test("the expiry is signed, so a hand-edited one is rejected", () => {
  process.env.OPS_TOKEN = "correct-horse";
  const now = Date.UTC(2026, 0, 1, 9, 0, 0);
  const [, nonce, signature] = issueSession(now).split(".");
  const forged = `${Math.floor(now / 1000) + 999_999}.${nonce}.${signature}`;
  assert.equal(verifySession(forged, now), false, "extending your own session must not work");
});

test("two logins are distinct credentials", () => {
  process.env.OPS_TOKEN = "correct-horse";
  assert.notEqual(issueSession(), issueSession(), "a shared, identical cookie cannot be revoked individually");
});

test("a session signed with a different token is refused", () => {
  process.env.OPS_TOKEN = "old-token";
  const oldSession = issueSession();
  process.env.OPS_TOKEN = "rotated-token";
  assert.equal(verifySession(oldSession), false, "rotating OPS_TOKEN must end existing sessions");
});
