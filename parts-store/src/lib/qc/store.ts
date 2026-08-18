/**
 * Quote Center store — file-backed persistence (Node runtime only), same
 * pattern as rfqStore.ts: single JSON file, atomic tmp+rename writes, an
 * in-process write mutex, single-instance by design.
 *
 * DATA PROTECTION: quotes/catalog carry dealer pricing, cost and client PII.
 * The file lives in gitignored `.data/`; the ONLY read paths are the
 * ops-gated /api/qc/* routes and the tokenized public quote endpoint
 * (which serves the client-safe doc model, never raw internal fields).
 *
 * DURABILITY RULES (each one exists because breaking it lost real data):
 * - A damaged store file is NEVER overwritten. It is renamed aside so the
 *   bytes survive for recovery, because reads happen on customer-triggered
 *   paths and a read must never be able to destroy the quote book.
 * - An empty segment means "the user emptied it", not "unseeded" — seeding
 *   only ever happens when a segment is absent, so deleted demo machines
 *   stay deleted instead of resurrecting and being written back.
 * - Quote writes carry a rev. A client PUT holding an older rev than the
 *   stored copy loses that quote, which is what stops a long-open staff tab
 *   from erasing a customer's signature.
 */

import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { audit } from "@/lib/auditLog";
import { SEED_CATALOG, qcDefaults, seedClients, seedQuotes } from "./data";
import type { QcQuote, QcState } from "./types";

function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

function storePath(): string {
  return path.join(dataDir(), "qc.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Serializes every read AND write. Reads are inside the lock so a token
 * backfill can never write back a snapshot taken before someone else's
 * write landed. NOT reentrant — internal callers use loadFromDisk().
 */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

/**
 * Demo seeding is OPT-IN (QC_DEMO_SEED=1). The handoff's sample quote book
 * (fictional clients, invented dollar figures) must never be a production
 * default — a fresh deployment starts with an empty, truthful pipeline.
 * The equipment catalog and settings always seed: that is configuration,
 * not business data.
 */
function demoSeed(): boolean {
  return process.env.QC_DEMO_SEED === "1";
}

function seeded(): QcState {
  return {
    quotes: demoSeed() ? seedQuotes() : [],
    clients: demoSeed() ? seedClients() : [],
    settings: qcDefaults(),
    catalog: JSON.parse(JSON.stringify(SEED_CATALOG)) as QcState["catalog"],
  };
}

/** Every quote must carry a share token — the public link is /q/[id]/[token]. */
function ensureTokens(state: QcState): boolean {
  let changed = false;
  for (const q of state.quotes) {
    if (!q.token) {
      q.token = randomUUID().replace(/-/g, "");
      changed = true;
    }
  }
  return changed;
}

/**
 * Move an unparseable store aside instead of letting the seed overwrite it.
 * Returns quietly on failure — preserving data is best-effort, but we must
 * never proceed to write over bytes we could not save.
 */
async function quarantine(): Promise<string | null> {
  const dest = `${storePath()}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    await rename(storePath(), dest);
    audit("qc_store_corrupt");
    console.error(`[qc-store] unreadable store quarantined to ${dest} — starting from seed data; recover the file before entering new work`);
    return dest;
  } catch {
    return null;
  }
}

/**
 * Read the store without touching the mutex (safe to call inside locked()).
 * Throws on unexpected I/O errors — failing loudly beats silently serving
 * seed data over a store that is merely unreadable right now.
 */
async function loadFromDisk(): Promise<{ state: QcState; needsWrite: boolean }> {
  let raw: string;
  try {
    raw = await readFile(storePath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const state = seeded();
      ensureTokens(state);
      return { state, needsWrite: true };
    }
    throw err;
  }

  let parsed: Partial<QcState>;
  try {
    parsed = JSON.parse(raw) as Partial<QcState>;
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
  } catch {
    await quarantine();
    const state = seeded();
    ensureTokens(state);
    return { state, needsWrite: true };
  }

  const seed = seeded();
  // Array.isArray, not .length — an empty segment is a deliberate state.
  const state: QcState = {
    quotes: Array.isArray(parsed.quotes) ? parsed.quotes : seed.quotes,
    clients: Array.isArray(parsed.clients) ? parsed.clients : seed.clients,
    settings: Object.assign(seed.settings, parsed.settings || {}),
    catalog: Array.isArray(parsed.catalog) ? parsed.catalog : seed.catalog,
  };
  return { state, needsWrite: ensureTokens(state) };
}

export function readQcState(): Promise<QcState> {
  return locked(async () => {
    const { state, needsWrite } = await loadFromDisk();
    if (needsWrite) await writeAll(state);
    return state;
  });
}

/**
 * Atomic + durable: fsync the temp file before the rename and fsync the
 * directory after it, so a crash cannot leave the rename visible while the
 * contents are still only in the page cache (which is exactly the truncated
 * file the corrupt-store path then has to deal with).
 */
async function writeAll(state: QcState): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = storePath() + "." + randomUUID().slice(0, 8) + ".tmp";
  try {
    const fh = await open(tmp, "w");
    try {
      await fh.writeFile(JSON.stringify(state), "utf8");
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
    // Never leave an orphaned tmp file behind on a failed write.
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

export interface QcPatchResult {
  state: QcState;
  /** Quote ids whose incoming copy was stale and therefore refused. */
  conflicts: string[];
}

/**
 * Merge an incoming quotes array over the stored one.
 *
 * Membership follows the client (so deleting a quote works), but per-quote
 * CONTENT follows whichever side is newer by rev. A stale client copy is
 * refused and the stored copy is kept, so a staff tab that loaded before a
 * customer signed cannot roll that signature back.
 *
 * Known limit: a quote created in another tab after this client loaded is
 * indistinguishable from one this client deleted, so it is treated as a
 * delete. Single-operator use makes that rare; the acceptance path — the
 * one that actually lost data — is fully covered because acceptances only
 * ever modify existing quotes.
 */
function mergeQuotes(incoming: QcQuote[], current: QcQuote[]): { quotes: QcQuote[]; conflicts: string[] } {
  const currentById = new Map(current.map((q) => [q.id, q]));
  const conflicts: string[] = [];
  const quotes = incoming.map((inc) => {
    const cur = currentById.get(inc.id);
    if (!cur) return { ...inc, rev: inc.rev ?? 1 };
    const curRev = cur.rev ?? 0;
    const incRev = inc.rev ?? 0;
    if (curRev > incRev) {
      conflicts.push(inc.id);
      return cur;
    }
    return { ...inc, rev: curRev + 1 };
  });
  return { quotes, conflicts };
}

/** Replace whole segments (mirrors the prototype's commit()); quotes merge by rev. */
export function patchQcState(patch: Partial<QcState>): Promise<QcPatchResult> {
  return locked(async () => {
    const { state: cur } = await loadFromDisk();
    let quotes = cur.quotes;
    let conflicts: string[] = [];
    if (patch.quotes) {
      const merged = mergeQuotes(patch.quotes, cur.quotes);
      quotes = merged.quotes;
      conflicts = merged.conflicts;
      if (conflicts.length) audit("qc_write_conflict", { n: conflicts.length });
    }
    const next: QcState = {
      quotes,
      clients: patch.clients ?? cur.clients,
      settings: patch.settings ?? cur.settings,
      catalog: patch.catalog ?? cur.catalog,
    };
    await writeAll(next);
    return { state: next, conflicts };
  });
}

/** Reset to seed data (Settings → "Restore demo data"). */
export function resetQcState(): Promise<QcState> {
  return locked(async () => {
    const next = seeded();
    ensureTokens(next);
    await writeAll(next);
    return next;
  });
}

/**
 * Mutate a single quote (public accept + view logging). Re-reads inside the
 * lock and bumps rev, so the result wins over any staff tab still holding an
 * older copy. Returns the updated quote or null when the id is unknown.
 */
export function mutateQuote(id: string, fn: (q: QcQuote) => QcQuote): Promise<QcQuote | null> {
  return locked(async () => {
    const { state: cur } = await loadFromDisk();
    const i = cur.quotes.findIndex((q) => q.id === id);
    if (i < 0) return null;
    const before = cur.quotes[i]!;
    const updated = fn(JSON.parse(JSON.stringify(before)) as QcQuote);
    updated.rev = (before.rev ?? 0) + 1;
    const quotes = cur.quotes.slice();
    quotes[i] = updated;
    await writeAll({ ...cur, quotes });
    return updated;
  });
}
