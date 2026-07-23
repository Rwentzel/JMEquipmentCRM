/**
 * Quote Center store — file-backed persistence (Node runtime only).
 *
 * DATA PROTECTION: quotes carry customer PII AND internal pricing/margin.
 * Everything lives in gitignored `.data/quotecenter.json`, readable only via
 * the ops-authed API — plus one narrow public path: a customer holding a
 * quote's unguessable shareToken may view/accept THAT quote (the "written
 * quote" the RFQ-first policy promises). Same atomic-write + mutex pattern
 * as rfqStore.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  genNumber,
  type QcClient,
  type QcSettings,
  type Quote,
  type QuoteStatus,
} from "./pricing";
import { SEED_MACHINES, type QcMachine } from "./seedCatalog";

interface QcState {
  quotes: Quote[];
  clients: QcClient[];
  settings: QcSettings;
  catalog: QcMachine[];
}

function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

function storePath(): string {
  return path.join(dataDir(), "quotecenter.json");
}

let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

function emptyState(): QcState {
  return { quotes: [], clients: [], settings: { ...DEFAULT_SETTINGS }, catalog: SEED_MACHINES.map((m) => ({ ...m })) };
}

async function readState(): Promise<QcState> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<QcState>;
    return {
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      catalog: Array.isArray(parsed.catalog) && parsed.catalog.length ? parsed.catalog : SEED_MACHINES.map((m) => ({ ...m })),
    };
  } catch {
    return emptyState();
  }
}

async function writeState(state: QcState): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = storePath() + "." + randomUUID().slice(0, 8) + ".tmp";
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await rename(tmp, storePath());
}

export async function getQcState(): Promise<QcState> {
  return readState();
}

export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

function tokenMatches(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Create or update a quote. Assigns id/number/token/dates on first save. */
export function saveQuote(input: Partial<Quote> & { clientCompany: string }): Promise<Quote> {
  return locked(async () => {
    const state = await readState();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const existing = input.id ? state.quotes.find((q) => q.id === input.id) : undefined;
    const quote: Quote = {
      id: existing?.id ?? "q" + randomUUID().slice(0, 12),
      shareToken: existing?.shareToken ?? newShareToken(),
      number: existing?.number ?? genNumber(state.quotes.length + 1, now),
      status: (input.status as QuoteStatus) ?? existing?.status ?? "draft",
      machineId: input.machineId ?? existing?.machineId ?? null,
      clientCompany: input.clientCompany,
      clientContact: input.clientContact ?? existing?.clientContact ?? "",
      clientDept: input.clientDept ?? existing?.clientDept ?? "",
      clientCity: input.clientCity ?? existing?.clientCity ?? "",
      clientEmail: input.clientEmail ?? existing?.clientEmail ?? "",
      po: input.po ?? existing?.po ?? "",
      base: +(input.base ?? existing?.base ?? 0),
      crating: +(input.crating ?? existing?.crating ?? 0),
      addons: input.addons ?? existing?.addons ?? [],
      parts: input.parts ?? existing?.parts ?? [],
      discMode: input.discMode ?? existing?.discMode ?? "amt",
      discAmt: +(input.discAmt ?? existing?.discAmt ?? 0),
      discPct: +(input.discPct ?? existing?.discPct ?? 0),
      freight: +(input.freight ?? existing?.freight ?? 0),
      tariffPct: +(input.tariffPct ?? existing?.tariffPct ?? 0),
      taxPct: +(input.taxPct ?? existing?.taxPct ?? 0),
      cost: +(input.cost ?? existing?.cost ?? 0),
      payment: input.payment ?? existing?.payment ?? "50-50",
      lead: input.lead ?? existing?.lead ?? "",
      warranty: input.warranty ?? existing?.warranty ?? "",
      validity: +(input.validity ?? existing?.validity ?? state.settings.validity),
      rep: input.rep ?? existing?.rep ?? state.settings.rep,
      notes: input.notes ?? existing?.notes ?? "",
      lostReason: input.lostReason ?? existing?.lostReason ?? "",
      signedName: existing?.signedName ?? "",
      signedDate: existing?.signedDate ?? "",
      createdAt: existing?.createdAt ?? today,
      updatedAt: today,
      followUpDate: input.followUpDate ?? existing?.followUpDate ?? "",
      followUpNote: input.followUpNote ?? existing?.followUpNote ?? "",
      followUpDone: input.followUpDone ?? existing?.followUpDone ?? false,
      activity: existing?.activity ?? [{ type: "created", date: today }],
    };
    if (existing && input.status && input.status !== existing.status) {
      quote.activity = [...quote.activity, { type: input.status as QcActivityType, date: today }];
    }
    const quotes = existing ? state.quotes.map((q) => (q.id === quote.id ? quote : q)) : [quote, ...state.quotes];
    await writeState({ ...state, quotes });
    return quote;
  });
}

type QcActivityType = Quote["activity"][number]["type"];

export function setQuoteStatus(id: string, status: QuoteStatus, lostReason?: string): Promise<Quote | null> {
  return locked(async () => {
    const state = await readState();
    const q = state.quotes.find((x) => x.id === id);
    if (!q) return null;
    const today = new Date().toISOString().slice(0, 10);
    q.status = status;
    q.updatedAt = today;
    if (status === "lost" && lostReason) q.lostReason = lostReason;
    q.activity = [...(q.activity ?? []), { type: status, date: today }];
    await writeState(state);
    return q;
  });
}

export function deleteQuote(id: string): Promise<boolean> {
  return locked(async () => {
    const state = await readState();
    const before = state.quotes.length;
    state.quotes = state.quotes.filter((q) => q.id !== id);
    await writeState(state);
    return state.quotes.length < before;
  });
}

/** Customer-facing lookup: id + constant-time token check. Records the view. */
export function getQuoteByToken(id: string, token: string, recordView = true): Promise<Quote | null> {
  return locked(async () => {
    const state = await readState();
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !tokenMatches(q.shareToken, token)) return null;
    if (recordView) {
      const today = new Date().toISOString().slice(0, 10);
      const last = [...(q.activity ?? [])].reverse().find((a) => a.type === "viewed");
      if (!last || last.date !== today) {
        q.activity = [...(q.activity ?? []), { type: "viewed", date: today }];
        await writeState(state);
      }
    }
    return q;
  });
}

/** Customer acceptance with typed signature (token-gated). */
export function acceptQuote(id: string, token: string, signedName: string): Promise<Quote | null> {
  return locked(async () => {
    const state = await readState();
    const q = state.quotes.find((x) => x.id === id);
    if (!q || !tokenMatches(q.shareToken, token)) return null;
    if (q.status === "won" || q.status === "lost") return null;
    const now = new Date();
    q.status = "accepted";
    q.signedName = signedName;
    q.signedDate = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    q.updatedAt = now.toISOString().slice(0, 10);
    q.activity = [...(q.activity ?? []), { type: "accepted", date: q.updatedAt, by: signedName }];
    await writeState(state);
    return q;
  });
}

export function saveClient(input: Partial<QcClient> & { company: string }): Promise<QcClient> {
  return locked(async () => {
    const state = await readState();
    const existing = input.id ? state.clients.find((c) => c.id === input.id) : undefined;
    const client: QcClient = {
      id: existing?.id ?? "c" + randomUUID().slice(0, 12),
      company: input.company,
      contact: input.contact ?? existing?.contact ?? "",
      email: input.email ?? existing?.email ?? "",
      phone: input.phone ?? existing?.phone ?? "",
      city: input.city ?? existing?.city ?? "",
      industry: input.industry ?? existing?.industry ?? "",
      notes: input.notes ?? existing?.notes ?? "",
    };
    const clients = existing ? state.clients.map((c) => (c.id === client.id ? client : c)) : [client, ...state.clients];
    await writeState({ ...state, clients });
    return client;
  });
}

export function deleteClient(id: string): Promise<void> {
  return locked(async () => {
    const state = await readState();
    state.clients = state.clients.filter((c) => c.id !== id);
    await writeState(state);
  });
}

export function saveSettings(patch: Partial<QcSettings>): Promise<QcSettings> {
  return locked(async () => {
    const state = await readState();
    state.settings = { ...state.settings, ...patch };
    await writeState(state);
    return state.settings;
  });
}

export function saveCatalog(catalog: QcMachine[]): Promise<void> {
  return locked(async () => {
    const state = await readState();
    state.catalog = catalog;
    await writeState(state);
  });
}
