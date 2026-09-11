"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * One modal dialog behaviour for every overlay in the app.
 *
 * - Rendered through a portal onto <body>, so that while it is open every
 *   other child of <body> can be made `inert`: not focusable, not clickable,
 *   hidden from assistive technology. Tab therefore stays inside the dialog
 *   without a hand-rolled focus trap, and a screen reader cannot wander
 *   into the page behind it.
 * - Focus moves to the first field or button inside on open, and returns to
 *   whatever had it on close — the button that opened the dialog, usually.
 * - Escape closes; so does a click on the backdrop.
 *
 * The overlay and card classes are the ones the Goodstrong screens already
 * style (gs-modal-overlay / gs-modal), so nothing moves on screen.
 */
export function Modal({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  // Who had focus before this dialog: read on the first render, before the
  // commit in which a child's autoFocus (the serial field, say) takes it.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  // Read through a ref so a fresh onClose arrow on every render does not
  // re-run the open/close effect (which would move focus on each keystroke).
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const el = overlay.current;
    if (!el) return;
    const previous = opener;
    const others = Array.from(document.body.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c !== el && !(c instanceof HTMLScriptElement),
    );
    const wasInert = others.map((c) => c.inert);
    for (const c of others) c.inert = true;

    const first = el.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea, button:not(.gs-modal__close), [href], [tabindex]:not([tabindex='-1'])",
    );
    (first ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      others.forEach((c, i) => {
        c.inert = wasInert[i] ?? false;
      });
      // The opener sat inside an inert subtree a moment ago; Chromium only
      // lets it take focus again after a style flush, so try now and once
      // more on the next frame.
      if (previous) {
        previous.focus();
        if (document.activeElement !== previous) requestAnimationFrame(() => previous.focus());
      }
    };
  }, [opener]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={overlay} className="gs-modal-overlay" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={() => close.current()}>
      <div className={"jme-card gs-modal" + (className ? ` ${className}` : "")} onClick={(e: MouseEvent) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
