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
import type { QcClient, QcQuote, QcState, QcTombstone } from "./types";

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
    // Tombstones must survive a reload or a deletion is forgotten the moment
    // the process restarts, and a stale tab can put the record back.
    tombstones: {
      quotes: Array.isArray(parsed.tombstones?.quotes) ? parsed.tombstones.quotes : [],
      clients: Array.isArray(parsed.tombstones?.clients) ? parsed.tombstones.clients : [],
    },
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

/** How long a deletion is remembered. Long enough to outlive any open tab. */
const TOMBSTONE_DAYS = 90;

function pruneTombstones(list: QcTombstone[], now: number): QcTombstone[] {
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000;
  return list.filter((t) => {
    const at = Date.parse(t.at);
    return Number.isFinite(at) ? at >= cutoff : true;
  });
}

function tombstonesOf(state: QcState): { quotes: QcTombstone[]; clients: QcTombstone[] } {
  return { quotes: state.tombstones?.quotes ?? [], clients: state.tombstones?.clients ?? [] };
}

/** Union existing tombstones with ids deleted by this request. */
function addTombstones(existing: QcTombstone[], ids: string[] | undefined, nowIso: string): QcTombstone[] {
  if (!ids?.length) return existing;
  const known = new Set(existing.map((t) => t.id));
  return [...existing, ...ids.filter((id) => !known.has(id)).map((id) => ({ id, at: nowIso }))];
}

/**
 * Merge an incoming quotes array over the stored one.
 *
 * Per-quote CONTENT follows whichever side is newer by rev, so a stale client
 * copy is refused and the stored copy kept — a staff tab that loaded before a
 * customer signed cannot roll that signature back.
 *
 * MEMBERSHIP is where data used to be lost. Absence alone cannot mean "delete",
 * because it is indistinguishable from "created in another tab after I loaded"
 * — so a second tab saving its own view silently destroyed the first tab's new
 * quote. Absence is now read against what the client says it knew:
 *
 *   - absent AND the client knew it   -> the client deleted it
 *   - absent AND the client never saw it -> created elsewhere; keep it
 *
 * `known` omitted keeps the original behaviour (absence deletes), so callers
 * that legitimately clear a segment — resets, bulk deletes, the existing
 * tests — are unaffected.
 */
function mergeQuotes(
  incoming: QcQuote[],
  current: QcQuote[],
  deleted: ReadonlySet<string>,
  known?: ReadonlySet<string>,
): { quotes: QcQuote[]; conflicts: string[]; kept: string[] } {
  const currentById = new Map(current.map((q) => [q.id, q]));
  const conflicts: string[] = [];
  const quotes = incoming
    .filter((inc) => !deleted.has(inc.id))
    .map((inc) => {
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

  const sent = new Set(incoming.map((q) => q.id));
  const kept: string[] = [];
  if (known) {
    for (const cur of current) {
      if (sent.has(cur.id) || deleted.has(cur.id) || known.has(cur.id)) continue;
      quotes.push(cur);
      kept.push(cur.id);
    }
  }
  return { quotes, conflicts, kept };
}

/** Same membership rule for the client book. */
function mergeClients(
  incoming: QcClient[],
  current: QcClient[],
  deleted: ReadonlySet<string>,
  known?: ReadonlySet<string>,
): { clients: QcClient[]; kept: string[] } {
  const sent = new Set(incoming.map((c) => c.id));
  const clients = incoming.filter((c) => !deleted.has(c.id));
  const kept: string[] = [];
  if (known) {
    for (const cur of current) {
      if (sent.has(cur.id) || deleted.has(cur.id) || known.has(cur.id)) continue;
      clients.push(cur);
      kept.push(cur.id);
    }
  }
  return { clients, kept };
}

/** A patch may also state, explicitly, what it deleted. */
export interface QcPatch extends Partial<QcState> {
  deleteQuoteIds?: string[];
  deleteClientIds?: string[];
  /**
   * The ids this client was working from. Supplying them lets the server tell
   * "the client deleted this" from "the client never saw this", which is what
   * makes a concurrent save safe. Omit them and absence deletes, as before.
   */
  knownQuoteIds?: string[];
  knownClientIds?: string[];
}

/**
 * Replace whole segments; quotes merge by rev, and membership is governed by
 * explicit deletions rather than by omission (see mergeQuotes).
 */
export function patchQcState(patch: QcPatch): Promise<QcPatchResult> {
  return locked(async () => {
    const { state: cur } = await loadFromDisk();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const prior = tombstonesOf(cur);
    const tombstones = {
      quotes: pruneTombstones(addTombstones(prior.quotes, patch.deleteQuoteIds, nowIso), nowMs),
      clients: pruneTombstones(addTombstones(prior.clients, patch.deleteClientIds, nowIso), nowMs),
    };
    const deletedQuotes = new Set(tombstones.quotes.map((t) => t.id));
    const deletedClients = new Set(tombstones.clients.map((t) => t.id));

    let quotes = cur.quotes.filter((q) => !deletedQuotes.has(q.id));
    let conflicts: string[] = [];
    if (patch.quotes) {
      const merged = mergeQuotes(
        patch.quotes,
        cur.quotes,
        deletedQuotes,
        patch.knownQuoteIds ? new Set(patch.knownQuoteIds) : undefined,
      );
      quotes = merged.quotes;
      conflicts = merged.conflicts;
      if (conflicts.length) audit("qc_write_conflict", { n: conflicts.length });
      // A record this client never saw, surviving its save, is the case that
      // used to be silent data loss. Worth seeing in the audit trail.
      if (merged.kept.length) audit("qc_concurrent_keep", { n: merged.kept.length });
    }

    let clients = cur.clients.filter((c) => !deletedClients.has(c.id));
    if (patch.clients) {
      const merged = mergeClients(
        patch.clients,
        cur.clients,
        deletedClients,
        patch.knownClientIds ? new Set(patch.knownClientIds) : undefined,
      );
      clients = merged.clients;
      if (merged.kept.length) audit("qc_concurrent_keep", { n: merged.kept.length });
    }

    const next: QcState = {
      quotes,
      clients,
      settings: patch.settings ?? cur.settings,
      catalog: patch.catalog ?? cur.catalog,
      tombstones,
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
