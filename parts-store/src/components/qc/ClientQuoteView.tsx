"use client";

/**
 * Client Quote View — the customer-facing shell behind a shared /q/[id]
 * link, ported from the design handoff. Dark stage with a sticky header
 * (Download PDF via window.print, Accept Quote), the rendered quote
 * document, and the typed-signature accept modal that POSTs to
 * /api/qc/shared/[id].
 */

import React, { useState } from "react";
import "@/styles/qc.css";
import { QuoteDoc } from "./QuoteDoc";
import type { QuoteDocModel } from "@/lib/qc/types";

export function ClientQuoteView({ id, token, initialDoc, initialCanAccept }: { id: string; token: string; initialDoc: QuoteDocModel; initialCanAccept: boolean }) {
  const [doc, setDoc] = useState<QuoteDocModel>(initialDoc);
  const [canAccept, setCanAccept] = useState(initialCanAccept);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigAgree, setSigAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "red" | "green" } | null>(null);

  const showToast = (msg: string, tone: "red" | "green" = "red") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2200);
  };

  const doAccept = async () => {
    if (!sigName.trim()) {
      showToast("Type your name to sign");
      return;
    }
    if (!sigAgree) {
      showToast("Please agree to the terms");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/qc/shared/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sigName.trim(), token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; doc?: QuoteDocModel; error?: string } | null;
      if (res.ok && data?.ok && data.doc) {
        setDoc(data.doc);
        setCanAccept(false);
        setAcceptOpen(false);
        showToast("Quote accepted — thank you", "green");
      } else {
        showToast(data?.error || "Could not record acceptance — please try again");
      }
    } catch {
      showToast("Could not record acceptance — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#33312e" }} data-screen-label="Client Quote View">
      <div
        data-print-hide
        style={{ background: "var(--ink-2)", color: "#fff", padding: "13px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 6, borderBottom: "1px solid #000" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/jme-diamond-cut.png" alt="JME" style={{ width: "30px", display: "block" }} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "15px", letterSpacing: ".05em", lineHeight: 1 }}>Secure Quotation</div>
            <div className="jme-mono" style={{ fontSize: "10px", color: "var(--paper-dim)", marginTop: "3px", letterSpacing: ".1em" }}>
              {doc.number} · for {doc.client.company}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "9px" }}>
          <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={() => window.print()}>Download PDF</button>
          {canAccept && (
            <button
              className="jme-btn jme-btn--sm"
              onClick={() => {
                setSigName("");
                setSigAgree(false);
                setAcceptOpen(true);
              }}
            >
              Accept Quote
            </button>
          )}
        </div>
      </div>

      <div id="clientPreviewCol" style={{ padding: "30px 16px 70px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div id="clientPreviewStage" style={{ width: "790px", maxWidth: "100%", flex: "none" }}>
            <QuoteDoc doc={doc} />
          </div>
        </div>
      </div>

      {acceptOpen && (
        <div
          data-print-hide
          onClick={() => setAcceptOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,12,.72)", zIndex: 50, display: "grid", placeItems: "center", padding: "20px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="on-light"
            style={{ background: "var(--canvas)", borderRadius: "var(--r-2)", maxWidth: "440px", width: "100%", boxShadow: "var(--sh-doc)", overflow: "hidden" }}
          >
            <div style={{ background: "var(--jme-charcoal)", color: "#fff", padding: "18px 24px" }}>
              <div className="jme-eyebrow" style={{ color: "var(--jme-red-bright)" }}>Accept Quotation</div>
              <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "22px", letterSpacing: ".04em", marginTop: "8px" }}>{doc.number}</div>
            </div>
            <div style={{ padding: "24px" }}>
              <p style={{ fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 18px" }}>
                Type your full legal name to electronically accept this quotation at{" "}
                <b style={{ color: "var(--ink-text)" }}>{doc.pricing.total}</b>. This records your acceptance and notifies
                JM Equipment Inc.
              </p>
              <div className="jme-field" style={{ marginBottom: "14px" }}>
                <label className="jme-field__label">Full Name</label>
                <input
                  className="jme-input"
                  placeholder="e.g. David Reyes"
                  value={sigName}
                  autoFocus
                  onChange={(e) => setSigName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doAccept();
                  }}
                />
              </div>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5, cursor: "pointer", marginBottom: "20px" }}>
                <input type="checkbox" checked={sigAgree} onChange={(e) => setSigAgree(e.target.checked)} style={{ marginTop: "2px" }} /> I am
                authorized to accept on behalf of {doc.client.company} and agree to the terms &amp; conditions stated in
                this quotation.
              </label>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={() => setAcceptOpen(false)}>Cancel</button>
                <button className="jme-btn jme-btn--sm" onClick={() => void doAccept()} disabled={busy}>
                  {busy ? "Signing…" : "Sign & Accept"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={"jme-toast" + (toast.tone === "green" ? " jme-toast--green" : "")}
          style={{ position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: 9999, textTransform: "uppercase", animation: "jmeToastIn .2s var(--ease)" }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
