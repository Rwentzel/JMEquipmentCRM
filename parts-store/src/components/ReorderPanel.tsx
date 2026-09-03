"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { readRecent, type RecentRequest } from "@/lib/recentRequests";

interface Loaded {
  ref: string;
  items: Array<{ sku: string; qty: number }>;
}

/**
 * Reorder from a previous request: reference + the email it was sent with.
 * The email is required every time (the reference is printed on confirmations
 * and is not a secret). Recent references from this device are offered as
 * one-tap chips; nothing else is stored locally.
 */
export function ReorderPanel({
  initialRef,
  onLoaded,
}: {
  initialRef?: string | null;
  onLoaded: (loaded: Loaded) => void;
}) {
  const [open, setOpen] = useState(Boolean(initialRef));
  const [ref, setRef] = useState(initialRef ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRequest[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    if (initialRef) {
      setRef(initialRef);
      setOpen(true);
    }
  }, [initialRef]);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/quote/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.items)) {
        setErr(data.error || "No request found for that reference and email.");
        return;
      }
      onLoaded({ ref: data.ref, items: data.items });
      setOpen(false);
    } catch {
      setErr("Could not reach the parts desk — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="ps-reorder ps-reorder--closed">
        <span>
          <b>Ordered before?</b> Reload the parts from a previous request with its reference and your email.
        </span>
        <button className="ps-reorder__toggle" onClick={() => setOpen(true)}>
          Reorder from a reference
        </button>
      </div>
    );
  }

  return (
    <div className="ps-reorder" role="region" aria-label="Reorder from a previous request">
      <div className="ps-reorder__hd">
        <b>Reorder from a previous request</b>
        <button className="ps-reorder__toggle" onClick={() => setOpen(false)} aria-label="Close reorder panel">
          ✕
        </button>
      </div>
      <p>
        Enter the reference from your confirmation (it looks like <span className="jme-mono">RFQ-A1B2C3D4</span>)
        and the email you sent it with. The parts load into your list with the same quantities — adjust anything, then
        submit for a fresh written quote. Pricing, stock, and lead time are reconfirmed every time.
      </p>
      {recent.length > 0 && (
        <div className="ps-reorder__recent" aria-label="Recent requests from this device">
          <span>Recent from this device:</span>
          {recent.map((r) => (
            <button key={r.ref} className="ps-reorder__chip" onClick={() => setRef(r.ref)} type="button">
              <span className="jme-mono">{r.ref}</span>
              <small>
                {new Date(r.at).toLocaleDateString()} · {r.n} line{r.n === 1 ? "" : "s"}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="ps-reorder__form">
        <label>
          Reference
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            placeholder="RFQ-A1B2C3D4"
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
          />
        </label>
        <label>
          Email used on that request
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </label>
        <Button onClick={() => void load()} disabled={busy || !ref.trim() || !email.trim()}>
          {busy ? "Loading…" : "Load parts"}
        </Button>
      </div>
      {err && (
        <p className="ps-field-err" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
