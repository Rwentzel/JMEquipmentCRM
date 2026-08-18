"use client";

/**
 * Equipment Catalog — category chips + machine cards with photo panel,
 * price-from line and "Start Quote"; edit mode exposes labeled inputs for
 * every field, spec rows, addon options, photo upload (replaces the
 * prototype's drag-drop image-slot) and add/remove machine.
 * Transcribed from the design handoff (qc_markup.html, Equipment Catalog).
 */

import type { QcApp } from "@/components/qc/useQcApp";
import type { QcMachine } from "@/lib/qc/types";
import { cfgMinBase, usd } from "@/lib/qc/logic";
import { NumberInput } from "@/components/NumberInput";

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-display)",
    textTransform: "uppercase",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: ".04em",
    padding: "7px 14px",
    borderRadius: "var(--r-1)",
    cursor: "pointer",
    border: "1px solid " + (active ? "var(--jme-red)" : "var(--hairline-2)"),
    background: active ? "var(--jme-red)" : "#fff",
    color: active ? "#fff" : "var(--muted)",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    whiteSpace: "nowrap",
  };
}

const addRowBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--hairline-2)",
  color: "var(--jme-red)",
  fontFamily: "var(--font-display)",
  textTransform: "uppercase",
  fontSize: "10px",
  letterSpacing: ".05em",
  padding: "3px 8px",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
};

const removeRowBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--hairline-2)",
  color: "var(--muted)",
  borderRadius: "var(--r-1)",
  cursor: "pointer",
  fontSize: "15px",
  lineHeight: 1,
  height: "32px",
};

const editRowHead: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

function MachineCard({ app, m }: { app: QcApp; m: QcMachine }) {
  const photo = app.effPhoto(m);
  const minBase = cfgMinBase(m);
  const priceStr = minBase != null ? "From " + usd(minBase) : m.base > 0 ? usd(m.base) : "Quote / Consult";
  const spec1 = m.specs[0] || { k: "", v: "" };
  const spec2 = m.specs[1] || { k: "", v: "" };

  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") app.setMachinePhoto(m.id, reader.result);
    };
    reader.readAsDataURL(f);
    input.value = "";
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-2)",
        boxShadow: "var(--sh-raise)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition:
          "transform var(--dur-fast) var(--ease),border-color var(--dur-fast) var(--ease),box-shadow var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "var(--jme-red)";
        e.currentTarget.style.boxShadow = "var(--sh-doc)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.borderColor = "var(--hairline)";
        e.currentTarget.style.boxShadow = "var(--sh-raise)";
      }}
    >
      <div style={{ height: "184px", background: "#fbfbfa", borderBottom: "1px solid var(--hairline)", position: "relative", overflow: "hidden" }}>
        <span
          className="jme-tag"
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            zIndex: 2,
            background: "#fff",
            whiteSpace: "nowrap",
            color: "var(--muted)",
            borderColor: "var(--hairline-2)",
            pointerEvents: "none",
          }}
        >
          {m.badge}
        </span>
        {photo ? (
          <div style={{ width: "100%", height: "184px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbfbfa" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={m.name}
              style={{
                width: "88%",
                height: "152px",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 12px 18px rgba(0,0,0,.16))",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: "184px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#fbfbfa",
            }}
          >
            <span style={{ width: "9px", height: "9px", background: "var(--jme-red)", transform: "rotate(45deg)", display: "block" }}></span>
            <span style={{ fontSize: "11px", color: "var(--subtle)", letterSpacing: ".06em", textTransform: "uppercase" }}>
              No photo on file
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "7px", flex: 1 }}>
        <div className="jme-mono" style={{ fontSize: "10px", color: "var(--jme-red)", letterSpacing: ".1em" }}>{m.sku}</div>
        {!!m.cfg && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontFamily: "var(--font-display)",
              textTransform: "uppercase",
              fontSize: "9.5px",
              letterSpacing: ".12em",
              color: "var(--jme-gold)",
            }}
          >
            <span style={{ width: "5px", height: "5px", background: "var(--jme-gold)", transform: "rotate(45deg)", display: "inline-block" }}></span>
            Configurable
          </div>
        )}
        <h3
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            fontSize: "21px",
            letterSpacing: ".03em",
            color: "var(--ink-text)",
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          {m.name}
        </h3>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>{m.sub}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
          <div style={{ background: "var(--canvas-tint)", borderRadius: "var(--r-1)", padding: "8px 10px" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--subtle)" }}>{spec1.k}</div>
            <div className="jme-mono" style={{ fontSize: "11px", color: "var(--ink-text)", marginTop: "2px" }}>{spec1.v}</div>
          </div>
          <div style={{ background: "var(--canvas-tint)", borderRadius: "var(--r-1)", padding: "8px 10px" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--subtle)" }}>{spec2.k}</div>
            <div className="jme-mono" style={{ fontSize: "11px", color: "var(--ink-text)", marginTop: "2px" }}>{spec2.v}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "18px", fontSize: "11.5px", color: "var(--ink-text)", marginTop: "auto", paddingTop: "8px" }}>
          <span>
            <span
              style={{
                color: "var(--subtle)",
                textTransform: "uppercase",
                letterSpacing: ".1em",
                fontSize: "8.5px",
                display: "block",
                marginBottom: "2px",
              }}
            >
              Lead Time
            </span>
            {m.lead}
          </span>
          <span>
            <span
              style={{
                color: "var(--subtle)",
                textTransform: "uppercase",
                letterSpacing: ".1em",
                fontSize: "8.5px",
                display: "block",
                marginBottom: "2px",
              }}
            >
              Warranty
            </span>
            {m.warranty}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "12px",
            marginTop: "12px",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "var(--jme-red)" }}>{priceStr}</div>
          <button className="jme-btn jme-btn--sm" onClick={() => app.startQuote(m.id)}>Start Quote</button>
        </div>
        {app.editEquip && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--hairline-2)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="jme-field">
              <label className="jme-field__label">Photo</label>
              <input className="jme-input" type="file" accept="image/*" onChange={onPhotoFile} style={{ padding: "7px 9px" }} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Name</label>
              <input className="jme-input" value={m.name} onChange={(e) => app.setMachineField(m.id, "name", e.target.value)} style={{ padding: "7px 9px" }} />
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Subtitle</label>
              <input className="jme-input" value={m.sub} onChange={(e) => app.setMachineField(m.id, "sub", e.target.value)} style={{ padding: "7px 9px" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div className="jme-field">
                <label className="jme-field__label">SKU</label>
                <input className="jme-input" value={m.sku} onChange={(e) => app.setMachineField(m.id, "sku", e.target.value)} style={{ padding: "7px 9px" }} />
              </div>
              <div className="jme-field">
                <label className="jme-field__label">Base ($)</label>
                <NumberInput
                  className="jme-input"
                  value={m.base}
                  onChange={(n) => app.setMachineField(m.id, "base", n)}
                  style={{ padding: "7px 9px" }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div className="jme-field">
                <label className="jme-field__label">Lead Time</label>
                <input className="jme-input" value={m.lead} onChange={(e) => app.setMachineField(m.id, "lead", e.target.value)} style={{ padding: "7px 9px" }} />
              </div>
              <div className="jme-field">
                <label className="jme-field__label">Warranty</label>
                <input className="jme-input" value={m.warranty} onChange={(e) => app.setMachineField(m.id, "warranty", e.target.value)} style={{ padding: "7px 9px" }} />
              </div>
            </div>
            <div className="jme-field">
              <label className="jme-field__label">Description</label>
              <textarea
                className="jme-textarea"
                rows={2}
                value={m.desc}
                onChange={(e) => app.setMachineField(m.id, "desc", e.target.value)}
                style={{ resize: "vertical", padding: "7px 9px" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={editRowHead}>Specifications</span>
              <button onClick={() => app.addMachineSpec(m.id)} style={addRowBtn}>+ Add</button>
            </div>
            {(m.specs || []).map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 30px", gap: "6px", alignItems: "center" }}>
                <input
                  className="jme-input"
                  placeholder="Label"
                  value={s.k}
                  onChange={(e) => app.setMachineSpec(m.id, i, "k", e.target.value)}
                  style={{ padding: "6px 8px" }}
                />
                <input
                  className="jme-input"
                  placeholder="Value"
                  value={s.v}
                  onChange={(e) => app.setMachineSpec(m.id, i, "v", e.target.value)}
                  style={{ padding: "6px 8px" }}
                />
                <button onClick={() => app.removeMachineSpec(m.id, i)} style={removeRowBtn}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={editRowHead}>Optional Add-ons</span>
              <button onClick={() => app.addMachineAddon(m.id)} style={addRowBtn}>+ Add</button>
            </div>
            {((m.cfg && m.cfg.options) || []).map((a, i) => (
              <div key={a.key} style={{ display: "grid", gridTemplateColumns: "1fr 82px 30px", gap: "6px", alignItems: "center" }}>
                <input
                  className="jme-input"
                  placeholder="Add-on label"
                  value={a.label}
                  onChange={(e) => app.setMachineAddon(m.id, i, "label", e.target.value)}
                  style={{ padding: "6px 8px" }}
                />
                <NumberInput
                  className="jme-input"
                  placeholder="$"
                  value={a.amount}
                  onChange={(n) => app.setMachineAddon(m.id, i, "amount", n)}
                  style={{ padding: "6px 8px", textAlign: "right" }}
                />
                <button onClick={() => app.removeMachineAddon(m.id, i)} style={removeRowBtn}>×</button>
              </div>
            ))}
            <button
              onClick={() => app.removeMachine(m.id)}
              style={{
                marginTop: "6px",
                background: "none",
                border: "1px solid var(--hairline-2)",
                color: "var(--jme-red)",
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                fontSize: "11px",
                letterSpacing: ".04em",
                padding: "6px 10px",
                borderRadius: "var(--r-1)",
                cursor: "pointer",
              }}
            >
              Remove Machine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipmentView({ app }: { app: QcApp }) {
  const cats = ["All", ...Array.from(new Set(app.catalog.map((m) => m.cat)))];
  const cards = app.catalog.filter((m) => app.equipCat === "All" || m.cat === app.equipCat);

  return (
    <div style={{ padding: "34px 40px" }} data-screen-label="Equipment Catalog">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "18px", flexWrap: "wrap" }}>
        <div>
          <div className="jme-eyebrow">Quoting</div>
          <h2 className="jme-h2" style={{ color: "var(--ink-text)", marginTop: "10px" }}>Equipment Catalog</h2>
          <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "7px" }}>
            Sheeters, rollstands, guillotine cutters, the JME-VCS core splitter, and accessories — built, imported, and rebuilt under one roof. Pick
            one to start a configured quote.
          </div>
        </div>
        <div style={{ display: "flex", gap: "9px", flex: "none" }}>
          {app.editEquip && (
            <button className="jme-btn jme-btn--sm" onClick={app.addMachine}>+ Add Machine</button>
          )}
          <button className="jme-btn jme-btn--ghost jme-btn--sm" onClick={app.toggleEditEquip}>
            {app.editEquip ? "Done Editing" : "Edit Catalog"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {cats.map((c) => (
          <button key={c} onClick={() => app.setEquipCat(c)} style={chipStyle(app.equipCat === c)}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "18px" }}>
        {cards.map((m) => (
          <MachineCard key={m.id} app={app} m={m} />
        ))}
      </div>
    </div>
  );
}
