"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { DiagramPart } from "@/data/types";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

export function QtyPickerModal({
  part,
  locationCount,
  pageLabel,
  onConfirm,
  onClose,
}: {
  part: DiagramPart;
  locationCount: number;
  pageLabel: string;
  onConfirm: (qty: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [digits, setDigits] = useState("");

  const qty = mode === "all" ? part.qty : Math.max(1, Math.min(9999, parseInt(digits || "0", 10) || 1));

  /** Switching into custom mode always starts the keypad entry fresh, rather
   * than appending to the "replace all" seed value. */
  function pressKey(k: string) {
    const enteringCustom = mode !== "custom";
    if (enteringCustom) {
      setMode("custom");
      setDigits(k === "clear" || k === "back" ? "" : k);
      return;
    }
    if (k === "clear") return setDigits("");
    if (k === "back") return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d + k).slice(0, 4));
  }

  function step(delta: number) {
    const base = mode === "all" ? part.qty : parseInt(digits || "0", 10) || 1;
    setMode("custom");
    setDigits(String(Math.max(1, Math.min(9999, base + delta))));
  }

  return (
    <div className="gs-modal-overlay" role="dialog" aria-modal="true" aria-label="Choose quantity" onClick={onClose}>
      <div className="jme-card gs-modal gs-qtymodal" onClick={(e) => e.stopPropagation()}>
        <div className="jme-card__hd">
          <h3>Add to request</h3>
          <button className="gs-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="jme-card__body">
          <div className="gs-qtymodal__part">
            <span className="gs-bubble">{part.bubble}</span>
            <div>
              <div className="jme-mono">{part.sku}</div>
              <div>{part.name}</div>
            </div>
            <span className="jme-mono ps-fine gs-qtymodal__page">p. {pageLabel}</span>
          </div>

          {locationCount > 1 && (
            <p className="gs-modal__note">
              This part appears in {locationCount} locations on this page — replace all {part.qty}, or choose your
              own amount.
            </p>
          )}

          <div className="gs-qtymodal__choice">
            <button
              type="button"
              className={"jme-btn jme-btn--ghost" + (mode === "all" ? " gs-qtymodal__choice--on" : "")}
              onClick={() => {
                setMode("all");
                setDigits("");
              }}
            >
              Replace all ({part.qty})
            </button>
            <button
              type="button"
              className={"jme-btn jme-btn--ghost" + (mode === "custom" ? " gs-qtymodal__choice--on" : "")}
              onClick={() => {
                if (mode !== "custom") {
                  setMode("custom");
                  setDigits("");
                }
              }}
            >
              Custom amount
            </button>
          </div>

          <div className="gs-qtymodal__stepper">
            <button type="button" aria-label="Decrease quantity" onClick={() => step(-1)}>
              −
            </button>
            <span className="jme-mono gs-qtymodal__qty">{qty}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => step(1)}>
              +
            </button>
          </div>

          <div className="gs-keypad" role="group" aria-label="Numeric keypad">
            {KEYPAD_DIGITS.map((k) => (
              <button
                key={k}
                type="button"
                className="gs-keypad__key"
                aria-label={k === "clear" ? "Clear" : k === "back" ? "Backspace" : k}
                onClick={() => pressKey(k)}
              >
                {k === "clear" ? "C" : k === "back" ? "⌫" : k}
              </button>
            ))}
          </div>

          <div className="ps-actions">
            <Button onClick={() => onConfirm(qty)}>Add {qty} to request</Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
