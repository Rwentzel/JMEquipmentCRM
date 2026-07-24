/**
 * Quote Center store — file-backed persistence (Node runtime only), same
 * pattern as rfqStore.ts: single JSON file, atomic tmp+rename writes, an
 * in-process write mutex, single-instance by design.
 *
 * DATA PROTECTION: quotes/catalog carry dealer pricing, cost and client PII.
 * The file lives in gitignored `.data/`; the ONLY read paths are the
 * ops-gated /api/qc/* routes and the tokenized public quote endpoint
 * (which serves the client-safe doc model, never raw internal fields).
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { SEED_CATALOG, qcDefaults, seedClients, seedQuotes } from "./data";
import type { QcState } from "./types";

function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

function storePath(): string {
  return path.join(dataDir(), "qc.json");
}

let writeChain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

function seeded(): QcState {
  return {
    quotes: seedQuotes(),
    clients: seedClients(),
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

/** Read + token backfill without touching the write mutex (safe inside locked()). */
async function readRaw(): Promise<{ state: QcState; backfilled: boolean }> {
  let state: QcState;
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<QcState>;
    const seed = seeded();
    state = {
      quotes: parsed.quotes && parsed.quotes.length ? parsed.quotes : seed.quotes,
      clients: parsed.clients && parsed.clients.length ? parsed.clients : seed.clients,
      settings: Object.assign(seed.settings, parsed.settings || {}),
      catalog: parsed.catalog && parsed.catalog.length ? parsed.catalog : seed.catalog,
    };
  } catch {
    state = seeded();
  }
  return { state, backfilled: ensureTokens(state) };
}

export async function readQcState(): Promise<QcState> {
  const { state, backfilled } = await readRaw();
  if (backfilled) await locked(() => writeAll(state));
  return state;
}

async function writeAll(state: QcState): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = storePath() + "." + randomUUID().slice(0, 8) + ".tmp";
  await writeFile(tmp, JSON.stringify(state), "utf8");
  await rename(tmp, storePath());
}

/** Replace whole segments (mirrors the prototype's commit()); returns the new state. */
export function patchQcState(patch: Partial<QcState>): Promise<QcState> {
  return locked(async () => {
    const { state: cur } = await readRaw();
    const next: QcState = {
      quotes: patch.quotes ?? cur.quotes,
      clients: patch.clients ?? cur.clients,
      settings: patch.settings ?? cur.settings,
      catalog: patch.catalog ?? cur.catalog,
    };
    await writeAll(next);
    return next;
  });
}

/** Reset to seed data (Settings → "Restore demo data"). */
export function resetQcState(): Promise<QcState> {
  return locked(async () => {
    const next = seeded();
    await writeAll(next);
    return next;
  });
}

/**
 * Mutate a single quote (public accept + view logging). Returns the updated
 * quote or null when the id is unknown.
 */
export function mutateQuote(id: string, fn: (q: QcState["quotes"][number]) => QcState["quotes"][number]): Promise<QcState["quotes"][number] | null> {
  return locked(async () => {
    const { state: cur } = await readRaw();
    const i = cur.quotes.findIndex((q) => q.id === id);
    if (i < 0) return null;
    const updated = fn(JSON.parse(JSON.stringify(cur.quotes[i])));
    const quotes = cur.quotes.slice();
    quotes[i] = updated;
    await writeAll({ ...cur, quotes });
    return updated;
  });
}
