/**
 * Audit log — structured, NON-PII operational events (Node runtime only).
 *
 * DATA PROTECTION: events carry an event kind, a timestamp, and numeric
 * counts ONLY. No user-supplied string ever enters this log — no names,
 * emails, companies, serials, message text, or IP addresses (rate-limit
 * keys are hashed before logging). The security agent reads this log to
 * detect abuse patterns; because it is PII-free it is safe to feed to an
 * LLM or ship to external monitoring later.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export type AuditKind =
  | "quote_accepted"
  | "quote_invalid"
  | "quote_honeypot"
  | "quote_rate_limited"
  | "assistant_query"
  | "assistant_rate_limited"
  | "ops_login_ok"
  | "ops_login_fail"
  | "ops_status_change"
  | "ops_export"
  | "mail_sent"
  | "mail_error"
  | "agent_run";

export interface AuditEvent {
  kind: AuditKind;
  ts: string;
  /** Numeric context only (e.g. item counts). Never strings from users. */
  n?: number;
  /** SHA-256 prefix of the client key — correlates abuse without storing IPs. */
  keyHash?: string;
}

const RING_MAX = 1000;
const ring: AuditEvent[] = [];

function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

function logPath(): string {
  return path.join(dataDir(), "audit.jsonl");
}

/** Hash a client key (IP-ish) so abuse is correlatable but the IP is not stored. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/** Record an event. File append is best-effort; the in-memory ring always works. */
export function audit(kind: AuditKind, opts: { n?: number; keyHash?: string } = {}): void {
  const event: AuditEvent = { kind, ts: new Date().toISOString(), ...opts };
  ring.push(event);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  void mkdir(dataDir(), { recursive: true })
    .then(() => appendFile(logPath(), JSON.stringify(event) + "\n", "utf8"))
    .catch(() => undefined);
}

/** Most recent events, newest last. Merges the on-disk tail with the ring. */
export async function recentEvents(limit = 500): Promise<AuditEvent[]> {
  let fromDisk: AuditEvent[] = [];
  try {
    const raw = await readFile(logPath(), "utf8");
    fromDisk = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AuditEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEvent => e !== null);
  } catch {
    // no file yet — ring only
  }
  // Disk already contains everything audited in this process; dedupe by identity
  // is unnecessary since ring events are appended to disk too. Prefer disk, fall
  // back to ring when the file is unavailable (e.g. read-only FS).
  const source = fromDisk.length >= ring.length ? fromDisk : ring;
  return source.slice(-limit);
}
