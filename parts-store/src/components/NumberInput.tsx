"use client";

import { useState } from "react";

/**
 * A numeric field that lets you type the number you mean.
 *
 * The quote builder previously wired `value={n}` to a native
 * `<input type="number">` and wrote back `+e.target.value || 0` on every
 * keystroke. Two things go wrong with that, both silently:
 *
 *   - `type="number"` refuses to report a half-typed decimal, so the "." in
 *     1500.50 never survives the round trip. Rewriting the value mid-typing
 *     also resets the caret to the front of the field, so the digits after the
 *     dot land in the wrong place. Typing 1500.50 into Base ($) stored 501500.
 *   - `|| 0` turns an empty field into a literal 0, so the field cannot be
 *     cleared — backspacing to empty snaps it back to "0" and the next digit
 *     types after it.
 *
 * Those are money fields on a quote a customer signs. The fix is to stop
 * rewriting what the user is typing: hold their exact keystrokes in `draft`
 * and report the parsed number alongside. On blur the draft is dropped and the
 * canonical number shows, so the field always settles on something valid.
 *
 * This is `type="text"` with `inputMode="decimal"` rather than
 * `type="number"` — same numeric keypad on a phone, without the value
 * sanitizing that caused the problem. Spinner arrows are not a loss on a
 * dollar amount.
 */
/**
 * Decides what a keystroke does to a numeric field: whether the new text is on
 * its way to being a number, and what number to report while the user types.
 *
 * Split out from the component so the rules can be tested directly — the
 * regression this file exists to fix was a parsing bug, not a rendering one.
 */
export function acceptNumericDraft(
  raw: string,
  opts: { allowNegative?: boolean; integer?: boolean } = {},
): { accept: false } | { accept: true; value: number } {
  const pattern = opts.integer
    ? opts.allowNegative
      ? /^-?\d*$/
      : /^\d*$/
    : opts.allowNegative
      ? /^-?\d*\.?\d*$/
      : /^\d*\.?\d*$/;
  if (!pattern.test(raw)) return { accept: false };
  const n = Number(raw);
  // "", "." and "-" are legitimate things to be in the middle of typing; they
  // are not numbers yet, so report 0 while leaving the draft text alone.
  return { accept: true, value: Number.isFinite(n) ? n : 0 };
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  allowNegative = false,
  integer = false,
  onBlur,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  /** Clamped on blur, never mid-keystroke — clamping as you type is what makes a field impossible to clear. */
  min?: number;
  /** Clamped on blur, as with `min`. */
  max?: number;
  allowNegative?: boolean;
  /** Whole numbers only — quantities, days, counts. */
  integer?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max">) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const next = acceptNumericDraft(raw, { allowNegative, integer });
        // Anything not on the way to being a number is ignored outright — the
        // previous draft stands rather than a value being substituted for it.
        if (!next.accept) return;
        setDraft(raw);
        onChange(next.value);
      }}
      onBlur={(e) => {
        setDraft(null);
        if (min !== undefined && value < min) onChange(min);
        else if (max !== undefined && value > max) onChange(max);
        onBlur?.(e);
      }}
    />
  );
}
