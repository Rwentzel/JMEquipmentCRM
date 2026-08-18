/**
 * RFQ store — file-backed persistence for quote requests (Node runtime only).
 *
 * DATA PROTECTION: records contain customer contact PII and therefore live
 * OUTSIDE the repo working set — in `.data/` (gitignored) — and are only ever
 * readable through the token-gated ops API. Nothing here is importable from
 * client components (fs would fail the build), and no record field is ever
 * written to logs. See DATA_BOUNDARIES.md.
 *
 * Storage is a single JSON file with atomic tmp+rename writes and an
 * in-process write mutex — adequate for a single-instance deployment.
 * Production at scale should swap this module for a real database; the
 * exported API is intentionally small so that swap is a one-file change.
 */

import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { audit } from "@/lib/auditLog";

export type RfqStatus = "new" | "reviewing" | "quoted" | "won" | "lost" | "archived";

export const RFQ_STATUSES: RfqStatus[] = ["new", "reviewing", "quoted", "won", "lost", "archived"];

export interface StoredRfqContact {
  company: string;
  name: string;
  lastName?: string;
  email: string;
  phone?: string;
  phoneExt?: string;
  serial?: string;
  shipAddress?: string;
  billingSameAsShipping?: boolean;
  billingAddress?: string;
  wantsAccount?: boolean;
}

export interface StoredRfqItem {
  sku: string;
  qty: number;
  /**
   * Configurator selections as resolved labels ("Power: 5 HP / 460V 3Ø").
   * Absent when the customer took the standard build, or for a plain part.
   */
  config?: string[];
}

export interface StoredRfq {
  ref: string;
  createdAt: string;
  updatedAt: string;
  status: RfqStatus;
  contact: StoredRfqContact;
  items: StoredRfqItem[];
  message?: string;
  /** True when any line item carries a freight-quote action. */
  freight: boolean;
}

function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

function storePath(): string {
  return path.join(dataDir(), "rfqs.json");
}

/** Serialize writes so concurrent requests can't interleave read-modify-write. */
let writeChain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

/**
 * Move an unreadable store aside so the next write cannot overwrite it.
 * Without this, one corrupt byte plus one ordinary customer submission
 * silently replaces the entire RFQ book with a single record.
 */
async function quarantine(): Promise<void> {
  const dest = `${storePath()}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    await rename(storePath(), dest);
    audit("rfq_store_corrupt");
    console.error(`[rfq-store] unreadable store quarantined to ${dest} — starting a fresh store; recover the file before working the queue`);
  } catch {
    /* best effort — if we cannot preserve it we still must not write over it silently */
  }
}

async function readAll(): Promise<StoredRfq[]> {
  let raw: string;
  try {
    raw = await readFile(storePath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err; // EACCES/EMFILE: fail loudly rather than pretend the store is empty
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StoredRfq[];
  } catch {
    /* fall through to quarantine */
  }
  await quarantine();
  return [];
}

/** Atomic AND durable — fsync the temp file and the directory around the rename. */
async function writeAll(rfqs: StoredRfq[]): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = storePath() + "." + randomUUID().slice(0, 8) + ".tmp";
  try {
    const fh = await open(tmp, "w");
    try {
      await fh.writeFile(JSON.stringify(rfqs, null, 2), "utf8");
      await fh.sync();
    } finally {
      await fh.close();
    }
    await rename(tmp, storePath());
    const dir = await open(dataDir(), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

export interface NewRfqInput {
  contact: StoredRfqContact;
  items: StoredRfqItem[];
  message?: string;
  freight: boolean;
}

/** Persist a new RFQ and return its crypto-random reference. */
export function saveRfq(input: NewRfqInput): Promise<StoredRfq> {
  return locked(async () => {
    const now = new Date().toISOString();
    const rfq: StoredRfq = {
      ref: "RFQ-" + randomUUID().slice(0, 8).toUpperCase(),
      createdAt: now,
      updatedAt: now,
      status: "new",
      contact: input.contact,
      items: input.items,
      message: input.message,
      freight: input.freight,
    };
    const all = await readAll();
    all.unshift(rfq);
    await writeAll(all);
    return rfq;
  });
}

/** Newest-first list, optionally filtered by status. */
export async function listRfqs(status?: RfqStatus): Promise<StoredRfq[]> {
  const all = await readAll();
  return status ? all.filter((r) => r.status === status) : all;
}

export async function getRfq(ref: string): Promise<StoredRfq | null> {
  const all = await readAll();
  return all.find((r) => r.ref === ref) ?? null;
}

/** Move an RFQ through its lifecycle. Returns null when the ref is unknown. */
export function updateRfqStatus(ref: string, status: RfqStatus): Promise<StoredRfq | null> {
  return locked(async () => {
    const all = await readAll();
    const rfq = all.find((r) => r.ref === ref);
    if (!rfq) return null;
    rfq.status = status;
    rfq.updatedAt = new Date().toISOString();
    await writeAll(all);
    return rfq;
  });
}


/** Result of a retention sweep. */
export interface RetentionResult {
  cutoff: string;
  archived: number;
  kept: number;
  archiveFile: string | null;
}

/**
 * PII retention sweep: move RFQs whose last update is older than `days` into
 * a dated archive file next to the store, then drop them from the live book.
 * Terminal statuses only (won/lost/archived) — open work is never purged.
 * Dry-run by default; pass apply=true to write.
 */
export function sweepRetention(days: number, apply = false): Promise<RetentionResult> {
  return locked(async () => {
    const cutoffMs = Date.now() - days * 86_400_000;
    const cutoff = new Date(cutoffMs).toISOString();
    const all = await readAll();
    const isExpired = (r: StoredRfq) =>
      Date.parse(r.updatedAt) < cutoffMs && (r.status === "won" || r.status === "lost" || r.status === "archived");
    const old = all.filter(isExpired);
    const kept = all.filter((r) => !isExpired(r));
    let archiveFile: string | null = null;
    if (apply && old.length > 0) {
      // Named for the RUN, not the cutoff: two sweeps with different windows
      // can share a cutoff date, and the archive must never overwrite an
      // earlier one — it is the only copy of the purged records.
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      archiveFile = path.join(dataDir(), `rfq-archive-${stamp}-cutoff-${cutoff.slice(0, 10)}.json`);
      await mkdir(dataDir(), { recursive: true });
      await writeFile(archiveFile, JSON.stringify(old, null, 2), { encoding: "utf8", flag: "wx" });
      await writeAll(kept);
    }
    return { cutoff, archived: old.length, kept: kept.length, archiveFile };
  });
}

/** Status → count map for the ops dashboard. */
export async function rfqCounts(): Promise<Record<RfqStatus, number>> {
  const all = await readAll();
  const counts = Object.fromEntries(RFQ_STATUSES.map((s) => [s, 0])) as Record<RfqStatus, number>;
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}
