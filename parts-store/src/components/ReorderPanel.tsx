"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { readRecent } from "@/lib/recentRequests";
import type { ReorderItem } from "@/lib/reorder";

interface Loaded {
  ref: string;
  items: ReorderItem[];
}

/**
 * Reorder from a previous request: reference + the email it was sent with.
 * The email is required every time (the reference is printed on confirmations
 * and is not a secret). Recent references from this device are offered as
 * one-tap chips; nothing else is stored locally.
 *
 * State is derived rather than synced: `initialRef` (from the ?reorder= deep
 * link) opens the panel and prefills the field until the customer overrides
 * either, so no effect has to copy props into state.
 */
export function ReorderPanel({
  initialRef,
  onLoaded,
}: {
  initialRef?: string | null;
  onLoaded: (loaded: Loaded) => void;
}) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [refInput, setRefInput] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = manualOpen ?? Boolean(initialRef);
  const ref = refInput ?? initialRef ?? "";
  // Read device memory only while the panel is open (client-only render path).
  const recent = useMemo(() => (open ? readRecent() : []), [open]);

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
      setManualOpen(false);
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
        <button className="ps-reorder__toggle" onClick={() => setManualOpen(true)}>
          Reorder from a reference
        </button>
      </div>
    );
  }

  return (
    <div className="ps-reorder" role="region" aria-label="Reorder from a previous request">
      <div className="ps-reorder__hd">
        <b>Reorder from a previous request</b>
        <button className="ps-reorder__toggle" onClick={() => setManualOpen(false)} aria-label="Close reorder panel">
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
            <button key={r.ref} className="ps-reorder__chip" onClick={() => setRefInput(r.ref)} type="button">
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
            onChange={(e) => setRefInput(e.target.value.toUpperCase())}
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
