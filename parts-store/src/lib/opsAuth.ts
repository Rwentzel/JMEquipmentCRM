/**
 * Ops console auth — single shared-token gate (Node runtime only).
 *
 * SECURITY MODEL (sandbox-appropriate, documented in SECURITY_NOTES.md):
 * - The token lives ONLY in the OPS_TOKEN environment variable — never in
 *   the repo. Production must set it; without it the console is DISABLED in
 *   production and open in local development (with a visible banner) so the
 *   sandbox can be demoed with zero secrets.
 * - The session cookie stores a SHA-256 digest of the token (httpOnly,
 *   sameSite=strict). Comparisons are constant-time.
 * - Production should replace this with real per-user auth (SSO) before
 *   multi-person use; the gate is deliberately one module so that swap is
 *   contained.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE = "jme_ops";

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

/** Value to store in the session cookie after a successful login. */
export function sessionValue(): string {
  const token = process.env.OPS_TOKEN;
  return token ? digest(token) : "";
}

/** Check a submitted login token against OPS_TOKEN. */
export function verifyLoginToken(submitted: string): boolean {
  const token = process.env.OPS_TOKEN;
  if (!token) return false;
  return safeEqual(digest(submitted), digest(token));
}

/** Check a session cookie value. In dev-open mode any request passes. */
export function verifySession(cookieValue: string | undefined): boolean {
  const mode = opsMode();
  if (mode === "dev-open") return true;
  if (mode === "disabled") return false;
  return typeof cookieValue === "string" && cookieValue.length > 0 && safeEqual(cookieValue, sessionValue());
}
