"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RequestItem } from "@/data/types";

const RKEY = "jme_request_v2";
const EVT = "jme-req";

/**
 * localStorage-backed request list, synced across components (custom `jme-req`
 * event) and across tabs (`storage` event). Built on useSyncExternalStore so
 * the list hydrates without setState-in-effect and stays consistent everywhere.
 */

const EMPTY: RequestItem[] = [];

/** getSnapshot must be referentially stable per raw value — cache the parse. */
let cache: { raw: string | null; items: RequestItem[] } = { raw: null, items: EMPTY };

function read(): RequestItem[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RKEY);
  } catch {
    return cache.items;
  }
  if (raw !== cache.raw) {
    let items: RequestItem[] = EMPTY;
    try {
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) items = parsed as RequestItem[];
    } catch {
      items = EMPTY;
    }
    cache = { raw, items };
  }
  return cache.items;
}

function getServerSnapshot(): RequestItem[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(items: RequestItem[]) {
  try {
    localStorage.setItem(RKEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private mode) — the event still notifies this tab
  }
  window.dispatchEvent(new Event(EVT));
}

export function useRequestList() {
  const items = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const add = useCallback((it: Omit<RequestItem, "qty">) => {
    const cur = read();
    const existing = cur.find((c) => c.sku === it.sku);
    if (existing) {
      write(cur.map((c) => (c.sku === it.sku ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      write([...cur, { ...it, qty: 1 }]);
    }
  }, []);

  /** Add (or overwrite the quantity of) an item with an explicit qty — used by the exploded-view quantity picker. */
  const addWithQty = useCallback((it: Omit<RequestItem, "qty">, qty: number) => {
    const cur = read();
    const existing = cur.find((c) => c.sku === it.sku);
    if (existing) {
      write(cur.map((c) => (c.sku === it.sku ? { ...c, ...it, qty } : c)));
    } else {
      write([...cur, { ...it, qty }]);
    }
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    write(read().map((i) => (i.sku === sku ? { ...i, qty } : i)));
  }, []);

  const remove = useCallback((sku: string) => {
    write(read().filter((i) => i.sku !== sku));
  }, []);

  const clear = useCallback(() => write([]), []);

  const count = items.reduce((s, i) => s + (i.qty || 1), 0);

  return { items, add, addWithQty, setQty, remove, clear, count };
}
