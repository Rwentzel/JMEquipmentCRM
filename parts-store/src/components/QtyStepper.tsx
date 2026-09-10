"use client";

import { NumberInput } from "@/components/NumberInput";

/** Where a quantity lands after a step: never below `min`, never above `max`. */
export function stepQty(current: number, delta: number, min = 1, max = 9999): number {
  const base = Number.isFinite(current) ? Math.floor(current) : min;
  return Math.min(max, Math.max(min, base + delta));
}

/**
 * Quantity stepper — the request list's line-item control.
 *
 * A typed number still works (the field is the same NumberInput), but on a
 * phone the −/+ buttons are what get used, so they are full 44px targets.
 * The minus is disabled at the minimum rather than turning into "remove":
 * removing a line is a separate, labelled button beside it.
 */
export function QtyStepper({
  value,
  onChange,
  label,
  min = 1,
  max = 9999,
}: {
  value: number;
  onChange: (n: number) => void;
  /** What the quantity is for, e.g. the SKU — used in the control labels. */
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="ps-stepper" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        className="ps-stepper__btn"
        aria-label={`Decrease quantity for ${label}`}
        disabled={value <= min}
        onClick={() => onChange(stepQty(value, -1, min, max))}
      >
        −
      </button>
      <NumberInput
        className="jme-input ps-qty"
        integer
        min={min}
        max={max}
        value={value}
        aria-label={`Quantity for ${label}`}
        onChange={(n) => onChange(stepQty(n, 0, min, max))}
      />
      <button
        type="button"
        className="ps-stepper__btn"
        aria-label={`Increase quantity for ${label}`}
        disabled={value >= max}
        onClick={() => onChange(stepQty(value, 1, min, max))}
      >
        +
      </button>
    </div>
  );
}
