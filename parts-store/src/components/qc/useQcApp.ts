"use client";

/**
 * Quote Center app core — the prototype's Component class ported to a React
 * hook. Holds the full store (quotes/clients/settings/catalog) plus UI
 * state, exposes the same action names the design's markup binds to, and
 * persists every commit to /api/qc/state (segment replace, like the
 * prototype's localStorage commit()).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPricedAxes,
  blankQuote,
  deriveActivity,
  genNumber,
  genToken,
  initConfig,
  normalizeQuote,
  nowISO,
  cashTotal,
  usd,
} from "@/lib/qc/logic";
import type { QcClient, QcMachine, QcPart, QcQuote, QcSettings, QcState, QcStatus } from "@/lib/qc/types";

export interface QcToast {
  msg: string;
  tone: "red" | "green";
}

export interface LossModal {
  id: string;
  reason: string;
}

export type QcView = "dash" | "pipeline" | "builder" | "equipment" | "parts" | "clients" | "analytics" | "settings";

export interface QcApp {
  // store segments
  quotes: QcQuote[];
  clients: QcClient[];
  settings: QcSettings;
  catalog: QcMachine[];
  parts: QcPart[];
  // ui state
  view: QcView;
  bq: QcQuote | null;
  equipCat: string;
  partQuery: string;
  partFam: string;
  pipeFilter: string;
  pipeQuery: string;
  pipeSort: { key: string; dir: "asc" | "desc" };
  clientId: string | null;
  editEquip: boolean;
  searchOpen: boolean;
  searchQuery: string;
  lossModal: LossModal | null;
  toast: QcToast | null;
  // helpers
  machine(id: string | null | undefined): QcMachine | null;
  effPhoto(m: QcMachine | null): string;
  baseUrl(): string;
  showToast(msg: string, tone?: "red" | "green"): void;
  // navigation
  go(view: QcView): void;
  navNewQuote(): void;
  // quote lifecycle
  startQuote(machineId?: string | null): void;
  editQuote(id: string): void;
  duplicateQuote(id: string): void;
  deleteQuote(id: string): void;
  saveQuote(qOpt?: QcQuote): boolean;
  setStatus(id: string, status: QcStatus, reason?: string): void;
  onPipeStatus(id: string, value: string): void;
  confirmLoss(): void;
  closeLoss(): void;
  setLossReason(reason: string): void;
  copyLink(id: string): void;
  openClientView(id: string): void;
  confirmDeleteQuote(id: string): void;
  emailQuote(q: QcQuote): void;
  previewClient(): void;
  sendCurrent(): void;
  // builder
  setBq(k: string, v: unknown): void;
  onMachineChange(id: string): void;
  pickConfig(axisKey: string, val: string): void;
  toggleCfgOpt(key: string): void;
  addAddon(): void;
  setAddon(i: number, k: "label" | "amount", v: string | number): void;
  removeAddon(i: number): void;
  setPartQty(i: number, qty: number): void;
  removePart(i: number): void;
  addPartToQuote(sku: string): void;
  loadClientInto(clientId: string): void;
  saveClientFromBq(): void;
  // clients
  addClient(): void;
  selectClient(id: string | null): void;
  setClientField(k: keyof QcClient, v: string): void;
  deleteClient(id: string): void;
  startQuoteForClient(id: string): void;
  // equipment catalog editing
  setEquipCat(c: string): void;
  toggleEditEquip(): void;
  addMachine(): void;
  removeMachine(id: string): void;
  setMachineField(id: string, k: string, v: string | number): void;
  setMachinePhoto(id: string, dataUrl: string): void;
  addMachineSpec(id: string): void;
  setMachineSpec(id: string, i: number, f: "k" | "v", v: string): void;
  removeMachineSpec(id: string, i: number): void;
  addMachineAddon(id: string): void;
  setMachineAddon(id: string, i: number, k: "label" | "amount", v: string | number): void;
  removeMachineAddon(id: string, i: number): void;
  // parts / pipeline filters
  setPartQuery(v: string): void;
  setPartFam(f: string): void;
  setPipeFilter(f: string): void;
  setPipeQuery(v: string): void;
  setPipeSort(key: string): void;
  // search
  openSearch(): void;
  closeSearch(): void;
  toggleSearch(): void;
  setSearchQuery(v: string): void;
  // settings
  setSetting(k: keyof QcSettings, v: string | number): void;
  saveSettings(): void;
  resetData(): void;
}

export function useQcApp(initialView: QcView, initialState: QcState, parts: QcPart[]): QcApp {
  const [quotes, setQuotes] = useState<QcQuote[]>(initialState.quotes);
  const [clients, setClients] = useState<QcClient[]>(initialState.clients);
  const [settings, setSettings] = useState<QcSettings>(initialState.settings);
  const [catalog, setCatalog] = useState<QcMachine[]>(initialState.catalog);
  const [view, setView] = useState<QcView>(initialView);
  const [bq, setBqState] = useState<QcQuote | null>(null);
  const [equipCat, setEquipCat] = useState("All");
  const [partQuery, setPartQuery] = useState("");
  const [partFam, setPartFam] = useState("All");
  const [pipeFilter, setPipeFilter] = useState("All");
  const [pipeQuery, setPipeQuery] = useState("");
  const [pipeSort, setPipeSortState] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });
  const [clientId, setClientId] = useState<string | null>(null);
  const [editEquip, setEditEquip] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lossModal, setLossModal] = useState<LossModal | null>(null);
  const [toast, setToast] = useState<QcToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------------------------------------ persist ---
   * Writes replace whole segments, so a naive PUT-per-keystroke both floods
   * the server and risks a slow early response landing after a fast later
   * one — persisting a stale prefix of what was typed. Patches are merged by
   * segment and flushed on a short trailing debounce (and immediately on
   * pagehide, so a quick navigation never drops the last edit). */
  const pending = useRef<Partial<QcState>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    void fetch("/api/qc/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  const persist = useCallback(
    (patch: Partial<QcState>) => {
      pending.current = { ...pending.current, ...patch };
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  const commitQuotes = useCallback(
    (qs: QcQuote[]) => {
      setQuotes(qs);
      persist({ quotes: qs });
    },
    [persist],
  );
  const commitClients = useCallback(
    (cs: QcClient[]) => {
      setClients(cs);
      persist({ clients: cs });
    },
    [persist],
  );
  const commitCatalog = useCallback(
    (cat: QcMachine[]) => {
      setCatalog(cat);
      persist({ catalog: cat });
    },
    [persist],
  );
  const commitSettings = useCallback(
    (s: QcSettings) => {
      setSettings(s);
      persist({ settings: s });
    },
    [persist],
  );

  /* ------------------------------------------------------------ helpers --- */
  const machine = useCallback(
    (id: string | null | undefined) => catalog.find((m) => m.id === id) || null,
    [catalog],
  );
  const effPhoto = useCallback((m: QcMachine | null) => (m ? m.photo || "" : ""), []);
  const baseUrl = useCallback(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  const showToast = useCallback((msg: string, tone: "red" | "green" = "red") => {
    setToast({ msg, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  /* --------------------------------------------------------- navigation --- */
  const go = useCallback(
    (v: QcView) => {
      setView(v);
      try {
        window.history.pushState(null, "", "/quotes/" + (v === "dash" ? "" : v));
      } catch {
        /* no-op */
      }
    },
    [],
  );

  useEffect(() => {
    const onPop = () => {
      const seg = window.location.pathname.replace(/^\/quotes\/?/, "").split("/")[0] || "dash";
      const views: QcView[] = ["dash", "pipeline", "builder", "equipment", "parts", "clients", "analytics", "settings"];
      setView(views.includes(seg as QcView) ? (seg as QcView) : "dash");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* ------------------------------------------------------------- quotes --- */
  const startQuote = useCallback(
    (machineId?: string | null) => {
      setBqState(blankQuote(machineId ?? null, catalog, settings, quotes.length));
      go("builder");
    },
    [catalog, settings, quotes.length, go],
  );

  const navNewQuote = useCallback(() => {
    if (bq) go("builder");
    else startQuote();
  }, [bq, go, startQuote]);

  const editQuote = useCallback(
    (id: string) => {
      const q = quotes.find((x) => x.id === id);
      if (!q) return;
      const c = normalizeQuote(JSON.parse(JSON.stringify(q)) as QcQuote, machine(q.machineId), settings);
      setBqState(c);
      go("builder");
    },
    [quotes, machine, settings, go],
  );

  const duplicateQuote = useCallback(
    (id: string) => {
      const q = quotes.find((x) => x.id === id);
      if (!q) return;
      const c = normalizeQuote(JSON.parse(JSON.stringify(q)) as QcQuote, machine(q.machineId), settings);
      c.id = "q" + Date.now();
      c.token = genToken();
      c.number = genNumber(quotes.length) + "-R";
      c.status = "draft";
      c.signedName = "";
      c.signedDate = "";
      c.followUpDone = false;
      c.createdAt = nowISO();
      c.activity = [{ type: "created", date: c.createdAt }];
      setBqState(c);
      go("builder");
      showToast("Revised copy created", "green");
    },
    [quotes, machine, settings, go, showToast],
  );

  const deleteQuote = useCallback(
    (id: string) => {
      commitQuotes(quotes.filter((q) => q.id !== id));
      showToast("Quote deleted");
    },
    [quotes, commitQuotes, showToast],
  );

  const saveQuote = useCallback(
    (qOpt?: QcQuote): boolean => {
      const src = qOpt || bq;
      if (!src) return false;
      if (!src.clientCompany) {
        showToast("Add a client company first");
        return false;
      }
      const b = JSON.parse(JSON.stringify(src)) as QcQuote;
      b.updatedAt = nowISO();
      if (!b.activity) b.activity = deriveActivity(b);
      const qs = quotes.slice();
      const i = qs.findIndex((x) => x.id === b.id);
      if (i >= 0 && qs[i]!.status !== b.status) {
        b.activity = b.activity.concat([{ type: b.status, date: nowISO() }]);
      }
      if (i >= 0) qs[i] = b;
      else qs.unshift(b);
      commitQuotes(qs);
      setBqState(JSON.parse(JSON.stringify(b)) as QcQuote);
      showToast("Quote saved", "green");
      return true;
    },
    [bq, quotes, commitQuotes, showToast],
  );

  const setStatus = useCallback(
    (id: string, status: QcStatus, reason?: string) => {
      const qs = quotes.map((q) => {
        if (q.id !== id) return q;
        const act = deriveActivity(q);
        act.push({ type: status, date: nowISO() });
        const patch: Partial<QcQuote> = { status, activity: act };
        if (status === "lost" && reason != null && reason !== "") patch.lostReason = reason;
        return { ...q, ...patch };
      });
      commitQuotes(qs);
      showToast("Status → " + status, "green");
      if (bq && bq.id === id) {
        setBqState((prev) => (prev ? { ...prev, status, ...(status === "lost" && reason ? { lostReason: reason } : {}) } : prev));
      }
    },
    [quotes, commitQuotes, showToast, bq],
  );

  const onPipeStatus = useCallback(
    (id: string, value: string) => {
      if (value === "lost") setLossModal({ id, reason: "" });
      else setStatus(id, value as QcStatus);
    },
    [setStatus],
  );

  const confirmLoss = useCallback(() => {
    if (!lossModal) return;
    const lm = lossModal;
    setLossModal(null);
    setStatus(lm.id, "lost", lm.reason);
  }, [lossModal, setStatus]);

  const shareUrl = useCallback(
    (q: QcQuote) => baseUrl() + "/q/" + q.id + "/" + (q.token || ""),
    [baseUrl],
  );

  const copyLink = useCallback(
    (id: string) => {
      const q = quotes.find((x) => x.id === id) || (bq && bq.id === id ? bq : null);
      if (!q) return;
      const url = shareUrl(q);
      try {
        void navigator.clipboard.writeText(url);
      } catch {
        /* no-op */
      }
      showToast("Client link copied", "green");
    },
    [quotes, bq, shareUrl, showToast],
  );

  /** Open the customer-facing page exactly as the customer sees it (token and all). */
  const openClientView = useCallback(
    (id: string) => {
      const q = quotes.find((x) => x.id === id);
      if (!q) return;
      window.open("/q/" + q.id + "/" + (q.token || ""), "_blank");
    },
    [quotes],
  );

  const confirmDeleteQuote = useCallback(
    (id: string) => {
      const q = quotes.find((x) => x.id === id);
      if (!q) return;
      const signed = q.status === "accepted" || q.status === "won";
      const warning = signed
        ? `\n\nWARNING: this quote was signed by the customer. Deleting it destroys that record and breaks the link they were sent.`
        : "";
      if (!window.confirm(`Delete quote ${q.number} for ${q.clientCompany || "this client"}?${warning}\n\nThis cannot be undone.`)) return;
      deleteQuote(id);
    },
    [quotes, deleteQuote],
  );

  const emailQuote = useCallback(
    (q: QcQuote) => {
      if (!q) return;
      const m = machine(q.machineId);
      const total = cashTotal(q, m);
      const totalStr = total > 0 ? usd(total) : "by consultation";
      const url = shareUrl(q);
      const subj = `JM Equipment Quotation ${q.number} — ${m ? m.name : "Parts"}`;
      const body = `Hello ${q.clientContact || q.clientCompany},\n\nThank you for the opportunity to quote. Please find your quotation below.\n\nQuote: ${q.number}\nEquipment: ${m ? m.name + " (" + m.sku + ")" : "Replacement parts"}\nTotal: ${totalStr}\nValid: ${q.validity} days, FOB ${settings.fob}\n\nView, download, and accept online:\n${url}\n\nRegards,\n${q.rep || settings.rep}\nJM Equipment Inc. · ${settings.phone}\n${settings.email}`;
      window.location.href = `mailto:${encodeURIComponent(q.clientEmail || "")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    },
    [machine, shareUrl, settings],
  );

  const previewClient = useCallback(() => {
    if (!bq) return;
    if (!saveQuote()) return;
    window.open("/q/" + bq.id + "/" + (bq.token || ""), "_blank");
  }, [bq, saveQuote]);

  const sendCurrent = useCallback(() => {
    if (!bq) return;
    const send: QcQuote = { ...bq, ...(bq.status === "draft" ? { status: "sent" as QcStatus } : {}) };
    if (!saveQuote(send)) return;
    emailQuote(send);
  }, [bq, saveQuote, emailQuote]);

  /* ------------------------------------------------------------ builder --- */
  const setBq = useCallback((k: string, v: unknown) => {
    setBqState((prev) => (prev ? ({ ...prev, [k]: v } as QcQuote) : prev));
  }, []);

  const onMachineChange = useCallback(
    (id: string) => {
      const m = machine(id);
      setBqState((prev) => {
        if (!prev) return prev;
        const next: QcQuote = {
          ...prev,
          machineId: id,
          base: m ? m.base : 0,
          crating: m ? m.crating : 0,
          payment: m ? m.payment : prev.payment,
          lead: m ? m.lead : "",
          warranty: m ? m.warranty : "",
          roiOn: !!(m && m.roi),
          tariffPct: m && m.isImport ? settings.tariff || 0 : 0,
        };
        initConfig(next, m);
        next.cost = Math.round((+next.base || 0) * 0.72);
        return next;
      });
    },
    [machine, settings],
  );

  const pickConfig = useCallback(
    (axisKey: string, val: string) => {
      setBqState((prev) => {
        if (!prev) return prev;
        const next: QcQuote = { ...prev, config: { ...prev.config, [axisKey]: val } };
        applyPricedAxes(next, machine(next.machineId));
        next.cost = Math.round((+next.base || 0) * 0.72);
        return next;
      });
    },
    [machine],
  );

  const toggleCfgOpt = useCallback((key: string) => {
    setBqState((prev) => {
      if (!prev) return prev;
      const cur = (prev.cfgOpts || []).slice();
      const i = cur.indexOf(key);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(key);
      return { ...prev, cfgOpts: cur };
    });
  }, []);

  const addAddon = useCallback(() => {
    setBqState((prev) => (prev ? { ...prev, addons: [...(prev.addons || []), { label: "", amount: 0 }] } : prev));
  }, []);

  const setAddon = useCallback((i: number, k: "label" | "amount", v: string | number) => {
    setBqState((prev) => {
      if (!prev) return prev;
      const a = (prev.addons || []).slice();
      a[i] = { ...a[i]!, [k]: v } as QcQuote["addons"][number];
      return { ...prev, addons: a };
    });
  }, []);

  const removeAddon = useCallback((i: number) => {
    setBqState((prev) => {
      if (!prev) return prev;
      const a = (prev.addons || []).slice();
      a.splice(i, 1);
      return { ...prev, addons: a };
    });
  }, []);

  const setPartQty = useCallback((i: number, qty: number) => {
    setBqState((prev) => {
      if (!prev) return prev;
      const p = (prev.parts || []).slice();
      p[i] = { ...p[i]!, qty: Math.max(1, qty || 1) };
      return { ...prev, parts: p };
    });
  }, []);

  const removePart = useCallback((i: number) => {
    setBqState((prev) => {
      if (!prev) return prev;
      const p = (prev.parts || []).slice();
      p.splice(i, 1);
      return { ...prev, parts: p };
    });
  }, []);

  const addPartToQuote = useCallback(
    (sku: string) => {
      const part = parts.find((p) => p.sku === sku);
      if (!part) return;
      setBqState((prev) => {
        let b = prev;
        if (!b) {
          b = blankQuote(null, catalog, settings, quotes.length);
          b.machineId = null;
          b.base = 0;
          b.crating = 0;
          b.roiOn = false;
        }
        const list = (b.parts || []).slice();
        const ex = list.findIndex((p) => p.sku === sku);
        if (ex >= 0) list[ex] = { ...list[ex]!, qty: list[ex]!.qty + 1 };
        else list.push({ sku: part.sku, name: part.name, qty: 1, price: part.price, rfq: part.price <= 0 });
        return { ...b, parts: list };
      });
      showToast("Added to quote", "green");
    },
    [parts, catalog, settings, quotes.length, showToast],
  );

  const loadClientInto = useCallback(
    (cid: string) => {
      if (!cid) return;
      const c = clients.find((x) => x.id === cid);
      if (!c) return;
      setBqState((prev) =>
        prev ? { ...prev, clientCompany: c.company, clientContact: c.contact, clientCity: c.city, clientEmail: c.email } : prev,
      );
    },
    [clients],
  );

  const saveClientFromBq = useCallback(() => {
    if (!bq || !bq.clientCompany) {
      showToast("Enter a company name first");
      return;
    }
    const exists = clients.some((c) => c.company.toLowerCase() === bq.clientCompany.toLowerCase());
    if (exists) {
      showToast("Client already on file");
      return;
    }
    const c: QcClient = {
      id: "c" + Date.now(),
      company: bq.clientCompany,
      contact: bq.clientContact,
      email: bq.clientEmail,
      phone: "",
      city: bq.clientCity,
      industry: "",
      notes: "",
    };
    commitClients([...clients, c]);
    showToast("Client saved", "green");
  }, [bq, clients, commitClients, showToast]);

  /* ------------------------------------------------------------ clients --- */
  const addClient = useCallback(() => {
    const c: QcClient = { id: "c" + Date.now(), company: "New Client", contact: "", email: "", phone: "", city: "", industry: "", notes: "" };
    commitClients([c, ...clients]);
    setClientId(c.id);
    go("clients");
    showToast("Client added — edit details", "green");
  }, [clients, commitClients, go, showToast]);

  const setClientField = useCallback(
    (k: keyof QcClient, v: string) => {
      if (!clientId) return;
      commitClients(clients.map((c) => (c.id === clientId ? { ...c, [k]: v } : c)));
    },
    [clientId, clients, commitClients],
  );

  const deleteClient = useCallback(
    (id: string) => {
      commitClients(clients.filter((c) => c.id !== id));
      setClientId(null);
      showToast("Client removed");
    },
    [clients, commitClients, showToast],
  );

  const startQuoteForClient = useCallback(
    (id: string) => {
      const c = clients.find((x) => x.id === id);
      const b = blankQuote(null, catalog, settings, quotes.length);
      if (c) {
        b.clientCompany = c.company;
        b.clientContact = c.contact;
        b.clientCity = c.city;
        b.clientEmail = c.email;
      }
      setBqState(b);
      go("builder");
    },
    [clients, catalog, settings, quotes.length, go],
  );

  /* ---------------------------------------------------------- equipment --- */
  const mutCat = useCallback(
    (fn: (cat: QcMachine[]) => void, after?: () => void) => {
      const cat = JSON.parse(JSON.stringify(catalog)) as QcMachine[];
      fn(cat);
      commitCatalog(cat);
      if (after) after();
    },
    [catalog, commitCatalog],
  );

  const addMachine = useCallback(() => {
    const id = "m" + Date.now();
    mutCat(
      (cat) => {
        cat.unshift({
          id,
          cat: "Custom",
          badge: "JME",
          sku: "NEW-SKU",
          name: "New Machine",
          sub: "",
          desc: "",
          specs: [
            { k: "Spec 1", v: "—" },
            { k: "Spec 2", v: "—" },
          ],
          base: 0,
          crating: 0,
          warranty: "1 Year",
          lead: "Consult",
          photo: "",
          payment: "50-50",
          isImport: false,
          roi: false,
          pkg: [],
          cfg: { title: "Options", options: [] },
        });
      },
      () => showToast("Machine added — edit details", "green"),
    );
  }, [mutCat, showToast]);

  const removeMachine = useCallback(
    (id: string) => {
      mutCat(
        (cat) => {
          const i = cat.findIndex((x) => x.id === id);
          if (i >= 0) cat.splice(i, 1);
        },
        () => showToast("Machine removed"),
      );
    },
    [mutCat, showToast],
  );

  const setMachineField = useCallback(
    (id: string, k: string, v: string | number) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (m) (m as unknown as Record<string, unknown>)[k] = v;
      });
    },
    [mutCat],
  );

  const setMachinePhoto = useCallback(
    (id: string, dataUrl: string) => {
      mutCat(
        (cat) => {
          const m = cat.find((x) => x.id === id);
          if (m) m.photo = dataUrl;
        },
        () => showToast("Photo attached — flows to quote documents", "green"),
      );
    },
    [mutCat, showToast],
  );

  const addMachineSpec = useCallback(
    (id: string) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (!m) return;
        if (!m.specs) m.specs = [];
        m.specs.push({ k: "", v: "" });
      });
    },
    [mutCat],
  );

  const setMachineSpec = useCallback(
    (id: string, i: number, f: "k" | "v", v: string) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (m && m.specs && m.specs[i]) m.specs[i]![f] = v;
      });
    },
    [mutCat],
  );

  const removeMachineSpec = useCallback(
    (id: string, i: number) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (m && m.specs) m.specs.splice(i, 1);
      });
    },
    [mutCat],
  );

  const addMachineAddon = useCallback(
    (id: string) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (!m) return;
        if (!m.cfg) m.cfg = { title: "Options" };
        if (!m.cfg.options) m.cfg.options = [];
        m.cfg.options.push({ key: "opt" + Date.now(), label: "", amount: 0 });
      });
    },
    [mutCat],
  );

  const setMachineAddon = useCallback(
    (id: string, i: number, k: "label" | "amount", v: string | number) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (m && m.cfg && m.cfg.options && m.cfg.options[i]) (m.cfg.options[i] as unknown as Record<string, unknown>)[k] = v;
      });
    },
    [mutCat],
  );

  const removeMachineAddon = useCallback(
    (id: string, i: number) => {
      mutCat((cat) => {
        const m = cat.find((x) => x.id === id);
        if (m && m.cfg && m.cfg.options) m.cfg.options.splice(i, 1);
      });
    },
    [mutCat],
  );

  /* ------------------------------------------------------------- search --- */
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const toggleSearch = useCallback(() => setSearchOpen((o) => !o), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggleSearch();
        return;
      }
      if (e.key === "Escape") {
        if (searchOpen) closeSearch();
        else if (lossModal) setLossModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, lossModal, toggleSearch, closeSearch]);

  /* ----------------------------------------------------------- settings --- */
  const setSetting = useCallback(
    (k: keyof QcSettings, v: string | number) => {
      commitSettings({ ...settings, [k]: v } as QcSettings);
    },
    [settings, commitSettings],
  );

  const saveSettings = useCallback(() => showToast("Settings saved", "green"), [showToast]);

  const resetData = useCallback(() => {
    // Drop any queued segment write — it predates the reset and would
    // otherwise land afterwards and resurrect the data we just discarded.
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    pending.current = {};
    void fetch("/api/qc/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.state) {
          setQuotes(d.state.quotes);
          setClients(d.state.clients);
          setSettings(d.state.settings);
          setCatalog(d.state.catalog);
          setBqState(null);
          setClientId(null);
          setEditEquip(false);
          showToast("Demo data restored", "green");
        }
      })
      .catch(() => showToast("Could not reset"));
  }, [showToast]);

  return useMemo<QcApp>(
    () => ({
      quotes,
      clients,
      settings,
      catalog,
      parts,
      view,
      bq,
      equipCat,
      partQuery,
      partFam,
      pipeFilter,
      pipeQuery,
      pipeSort,
      clientId,
      editEquip,
      searchOpen,
      searchQuery,
      lossModal,
      toast,
      machine,
      effPhoto,
      baseUrl,
      showToast,
      go,
      navNewQuote,
      startQuote,
      editQuote,
      duplicateQuote,
      deleteQuote,
      saveQuote,
      setStatus,
      onPipeStatus,
      confirmLoss,
      closeLoss: () => setLossModal(null),
      setLossReason: (reason: string) => setLossModal((lm) => (lm ? { ...lm, reason } : lm)),
      copyLink,
      openClientView,
      confirmDeleteQuote,
      emailQuote,
      previewClient,
      sendCurrent,
      setBq,
      onMachineChange,
      pickConfig,
      toggleCfgOpt,
      addAddon,
      setAddon,
      removeAddon,
      setPartQty,
      removePart,
      addPartToQuote,
      loadClientInto,
      saveClientFromBq,
      addClient,
      selectClient: (id: string | null) => setClientId(id),
      setClientField,
      deleteClient,
      startQuoteForClient,
      setEquipCat,
      toggleEditEquip: () => setEditEquip((e) => !e),
      addMachine,
      removeMachine,
      setMachineField,
      setMachinePhoto,
      addMachineSpec,
      setMachineSpec,
      removeMachineSpec,
      addMachineAddon,
      setMachineAddon,
      removeMachineAddon,
      setPartQuery,
      setPartFam,
      setPipeFilter,
      setPipeQuery,
      setPipeSort: (key: string) => {
        if (!key) return;
        setPipeSortState((cur) => {
          let dir: "asc" | "desc";
          if (cur.key === key) dir = cur.dir === "asc" ? "desc" : "asc";
          else dir = key === "value" || key === "created" ? "desc" : "asc";
          return { key, dir };
        });
      },
      openSearch,
      closeSearch,
      toggleSearch,
      setSearchQuery,
      setSetting,
      saveSettings,
      resetData,
    }),
    [
      quotes, clients, settings, catalog, parts, view, bq, equipCat, partQuery, partFam, pipeFilter, pipeQuery,
      pipeSort, clientId, editEquip, searchOpen, searchQuery, lossModal, toast, machine, effPhoto, baseUrl,
      showToast, go, navNewQuote, startQuote, editQuote, duplicateQuote, deleteQuote, saveQuote, setStatus,
      onPipeStatus, confirmLoss, copyLink, openClientView, confirmDeleteQuote, emailQuote, previewClient, sendCurrent, setBq, onMachineChange,
      pickConfig, toggleCfgOpt, addAddon, setAddon, removeAddon, setPartQty, removePart, addPartToQuote,
      loadClientInto, saveClientFromBq, addClient, setClientField, deleteClient, startQuoteForClient,
      addMachine, removeMachine, setMachineField, setMachinePhoto, addMachineSpec, setMachineSpec,
      removeMachineSpec, addMachineAddon, setMachineAddon, removeMachineAddon, openSearch, closeSearch,
      toggleSearch, setSetting, saveSettings, resetData,
    ],
  );
}
