/**
 * Ops console auth — single shared-token gate (Node runtime only).
 *
 * SECURITY MODEL (sandbox-appropriate, documented in SECURITY_NOTES.md):
 * - The token lives ONLY in the OPS_TOKEN environment variable — never in
 *   the repo. Production must set it; without it the console is DISABLED in
 *   production and open in local development (with a visible banner) so the
 *   sandbox can be demoed with zero secrets.
 * - The session cookie carries an expiry and a nonce, signed with an HMAC
 *   keyed by the token (httpOnly, secure, sameSite=strict). Comparisons are
 *   constant-time. It previously held a bare SHA-256 of the token, which was
 *   the same value for every session and for all time: the Max-Age was a
 *   browser-side hint only, so a captured cookie stayed valid until the token
 *   itself was rotated, and no single session could be expired or revoked.
 * - Production should replace this with real per-user auth (SSO) before
 *   multi-person use; the gate is deliberately one module so that swap is
 *   contained.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE = "jme_ops";

/** How long a session stays valid, server-side. Mirrored by the cookie Max-Age. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type OpsMode = "token" | "dev-open" | "disabled";

export function opsMode(): OpsMode {
  if (process.env.OPS_TOKEN) return "token";
  return process.env.NODE_ENV === "production" ? "disabled" : "dev-open";
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/**
 * Mint a session value for the cookie: `<expiry>.<nonce>.<signature>`.
 *
 * The expiry is inside the signed payload, so it is enforced here rather than
 * trusted from the browser, and the nonce makes every session distinct — two
 * logins no longer share one interchangeable credential.
 */
export function issueSession(nowMs: number = Date.now()): string {
  const token = process.env.OPS_TOKEN;
  if (!token) return "";
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${exp}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload, token)}`;
}

/** Check a submitted login token against OPS_TOKEN. */
export function verifyLoginToken(submitted: string): boolean {
  const token = process.env.OPS_TOKEN;
  if (!token) return false;
  return safeEqual(digest(submitted), digest(token));
}

/**
 * Check a session cookie value, rejecting anything expired or unsigned.
 * In dev-open mode any request passes.
 */
export function verifySession(cookieValue: string | undefined, nowMs: number = Date.now()): boolean {
  const mode = opsMode();
  if (mode === "dev-open") return true;
  if (mode === "disabled") return false;

  const token = process.env.OPS_TOKEN;
  if (!token || typeof cookieValue !== "string") return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, signature] = parts as [string, string, string];

  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp * 1000 <= nowMs) return false;
  if (nonce.length === 0) return false;

  return safeEqual(signature, sign(`${expRaw}.${nonce}`, token));
}
