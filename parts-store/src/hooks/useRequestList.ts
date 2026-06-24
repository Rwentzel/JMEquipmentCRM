"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequestItem } from "@/data/types";

const RKEY = "jme_request_v2";
const EVT = "jme-req";

function read(): RequestItem[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(localStorage.getItem(RKEY) || "[]") as RequestItem[]) || [];
  } catch {
    return [];
  }
}

function write(items: RequestItem[]) {
  localStorage.setItem(RKEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
}

/**
 * localStorage-backed request list, synced across components (custom `jme-req`
 * event) and across tabs (`storage` event). Mirrors the design bundle behavior.
 */
export function useRequestList() {
  const [items, setItems] = useState<RequestItem[]>([]);

  useEffect(() => {
    setItems(read());
    const sync = () => setItems(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((it: Omit<RequestItem, "qty">) => {
    const cur = read();
    const existing = cur.find((c) => c.sku === it.sku);
    if (existing) {
      write(cur.map((c) => (c.sku === it.sku ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      write([...cur, { ...it, qty: 1 }]);
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

  return { items, add, setQty, remove, clear, count };
}
