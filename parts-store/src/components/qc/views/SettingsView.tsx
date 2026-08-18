"use client";

/**
 * Settings view — company details, quote defaults, data reset, and the
 * standard terms & conditions list, ported from the design handoff. The
 * only copy change from the prototype: data is saved server-side now,
 * not in the browser.
 */

import React, { useId } from "react";
import type { QcApp } from "../useQcApp";
import { TERM_TPL } from "@/lib/qc/labels";
import type { QcSettings } from "@/lib/qc/types";
import { NumberInput } from "@/components/NumberInput";

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-2)",
  boxShadow: "var(--sh-raise)",
  padding: "22px 24px",
};

const h3: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  fontSize: "17px",
  letterSpacing: ".04em",
  color: "var(--ink-text)",
};

function Field({ app, label, k, num }: { app: QcApp; label: string; k: keyof QcSettings; num?: boolean }) {
  // The visible label was not tied to its input, so a screen reader announced
  // nine unnamed boxes on this screen. One id wires all of them.
  const id = useId();
  return (
    <div className="jme-field">
      <label className="jme-field__label" htmlFor={id}>{label}</label>
      {num ? (
        <NumberInput
          id={id}
          className="jme-input"
          value={Number(app.settings[k] ?? 0)}
          onChange={(n) => app.setSetting(k, n)}
        />
      ) : (
        <input
          id={id}
          className="jme-input"
          value={String(app.settings[k] ?? "")}
          onChange={(e) => app.setSetting(k, e.target.value)}
        />
      )}
    </div>
  );
}

export function SettingsView({ app }: { app: QcApp }) {
  return (
    <div style={{ padding: "34px 40px", maxWidth: "1000px" }} data-screen-label="Settings">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "22px", flexWrap: "wrap" }}>
        <div>
          <div className="jme-eyebrow">System</div>
          <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Settings</h2>
          <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>Company details and defaults applied to every new quote.</div>
        </div>
        <button className="jme-btn jme-btn--sm" onClick={app.saveSettings}>Save Settings</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "start" }}>
        <div style={card}>
          <h3 style={{ ...h3, margin: "0 0 16px" }}>Company</h3>
          <div style={{ marginBottom: "12px" }}><Field app={app} label="Company Name" k="company" /></div>
          <div style={{ marginBottom: "12px" }}><Field app={app} label="Address" k="addr" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <Field app={app} label="Phone" k="phone" />
            <Field app={app} label="Email" k="email" />
          </div>
          <Field app={app} label="Default Sales Rep" k="rep" />
        </div>
        <div style={card}>
          <h3 style={{ ...h3, margin: "0 0 16px" }}>Quote Defaults</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <Field app={app} label="Validity (days)" k="validity" num />
            <Field app={app} label="FOB" k="fob" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field app={app} label="Tariff %" k="tariff" num />
            <Field app={app} label="Markup %" k="markup" num />
          </div>
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--hairline)" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "8px" }}>Data</div>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
              Quotes and clients are saved to the Quote Center server. Restore the demo data set at any time.
            </p>
            <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.resetData}>Restore Demo Data</button>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginTop: "18px" }}>
        <h3 style={{ ...h3, margin: "0 0 6px" }}>Standard Terms &amp; Conditions</h3>
        <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "0 0 14px" }}>
          Applied to every quotation. {"{VALIDITY}"} and {"{FOB}"} fill in from each quote.
        </p>
        <ol style={{ margin: 0, paddingLeft: "20px" }}>
          {TERM_TPL.map((t) => (
            <li key={t.t} style={{ fontSize: "12.5px", color: "var(--ink-text)", lineHeight: 1.6, padding: "5px 0" }}>
              <b style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".03em", fontSize: "13px" }}>{t.t}.</b> {t.d}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
