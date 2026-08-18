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

import { appendFile, mkdir, open, rename, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export type AuditKind =
  | "quote_accepted"
  | "quote_invalid"
  | "quote_honeypot"
  | "quote_rate_limited"
  | "quote_store_failed"
  | "assistant_query"
  | "assistant_rate_limited"
  | "ops_login_ok"
  | "ops_login_fail"
  | "ops_status_change"
  | "ops_export"
  | "qc_change"
  | "qc_accept"
  | "qc_write_conflict"
  | "qc_concurrent_keep"
  | "qc_store_corrupt"
  | "rfq_store_corrupt"
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

/**
 * The log is append-only and never expires on its own, so without rotation it
 * grows for as long as the site runs — and a full volume is not a cosmetic
 * problem here: the RFQ write path fails when the disk fills. At ~83 bytes an
 * event, a modest 2,000 events/day reaches ~58 MB a year, and every ops-desk
 * page load and security-agent run used to read and parse the whole thing (a
 * measured 865 ms and 268 MB of heap at that size, to return 500 events).
 *
 * One previous generation is kept, so disk stays bounded at roughly twice the
 * threshold while recent history survives a rotation.
 */
const ROTATE_BYTES = 8 * 1024 * 1024;
/** Tail read for recentEvents: far more than any sane `limit`, cheap to scan. */
const TAIL_BYTES = 512 * 1024;

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

function rolledPath(): string {
  return `${logPath()}.1`;
}

/**
 * Rotate once the live log passes the threshold. Best-effort and non-blocking,
 * like the append itself: a failure here must never affect a request. rename()
 * is atomic, so a concurrent append either lands in the old file just before
 * the swap or the new one just after — never half in each.
 */
async function rotateIfLarge(): Promise<void> {
  try {
    const { size } = await stat(logPath());
    if (size < ROTATE_BYTES) return;
    await rename(logPath(), rolledPath());
  } catch {
    // No file yet, or a concurrent rotation already moved it. Either is fine.
  }
}

/**
 * Writes are chained rather than fired independently.
 *
 * Each call used to start its own mkdir().then(append), so two events raised in
 * quick succession raced and could land on disk in the opposite order to which
 * they happened — a log read back out of order is misleading precisely when
 * someone is reconstructing an incident from it. It also let a rotation
 * interleave between an append and the size check.
 */
let writeQueue: Promise<void> = Promise.resolve();

/** Record an event. File append is best-effort; the in-memory ring always works. */
export function audit(kind: AuditKind, opts: { n?: number; keyHash?: string } = {}): void {
  const event: AuditEvent = { kind, ts: new Date().toISOString(), ...opts };
  ring.push(event);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  writeQueue = writeQueue
    .then(() => mkdir(dataDir(), { recursive: true }))
    .then(() => appendFile(logPath(), JSON.stringify(event) + "\n", "utf8"))
    .then(() => rotateIfLarge())
    .catch(() => undefined);
}

/** Wait for queued writes to reach disk. For tests and orderly shutdown. */
export function flushAudit(): Promise<void> {
  return writeQueue;
}

/**
 * Read the last chunk of a log file and parse the complete lines in it.
 *
 * Only the tail is read: the whole point is to answer "the most recent N",
 * and reading a year of history to do that is what made this expensive. The
 * first line of the chunk is dropped when the read started mid-file, since it
 * is almost certainly a partial record.
 */
async function tailEvents(file: string): Promise<AuditEvent[]> {
  let handle;
  try {
    handle = await open(file, "r");
    const { size } = await handle.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    await handle.read(buf, 0, buf.length, start);
    const lines = buf.toString("utf8").split("\n");
    if (start > 0) lines.shift();
    return lines
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
    return [];
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Most recent events, newest last. Merges the on-disk tail with the ring. */
export async function recentEvents(limit = 500): Promise<AuditEvent[]> {
  let fromDisk = await tailEvents(logPath());
  // Just after a rotation the live file is nearly empty; reach back one
  // generation so the ops desk does not appear to lose its history.
  if (fromDisk.length < limit) {
    fromDisk = [...(await tailEvents(rolledPath())), ...fromDisk];
  }
  // Prefer disk, fall back to the ring when the file is unavailable (e.g. a
  // read-only filesystem), where the ring is the only record we have.
  const source = fromDisk.length >= ring.length ? fromDisk : ring;
  return source.slice(-limit);
}
