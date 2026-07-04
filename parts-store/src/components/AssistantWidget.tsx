"use client";

import { useEffect, useRef, useState } from "react";
import { Diamond } from "@/components/ui";

/**
 * Parts-desk assistant widget — floating launcher + chat panel.
 *
 * Talks to /api/assistant, which is grounded on the public catalog and FAQ
 * only (no prices, no quantities — see supportAgent.ts). Conversation state
 * is in-memory only: nothing is persisted or sent anywhere except the
 * question itself.
 */

interface Msg {
  role: "user" | "desk";
  text: string;
}

const SUGGESTIONS = [
  "Is the 1650 sheeter available?",
  "How does freight work on heavy parts?",
  "Can you match a part from another OEM?",
];

const GREETING =
  "Parts desk here. Ask about a machine, a part number, freight, or how quoting works. Pricing is always confirmed in writing — never online.";

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "desk", text: GREETING }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question }),
      });
      const data = await res.json().catch(() => ({}));
      const text =
        res.ok && typeof data.answer === "string"
          ? data.answer
          : data.error || "Could not reach the desk — try again in a moment.";
      setMsgs((m) => [...m, { role: "desk", text }]);
    } catch {
      setMsgs((m) => [...m, { role: "desk", text: "Could not reach the desk — try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={"ps-askbtn" + (open ? " on" : "")}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close parts desk assistant" : "Ask the parts desk"}
        aria-expanded={open}
        aria-controls="ps-ask-panel"
      >
        {open ? "×" : "Ask"}
      </button>

      {open && (
        <div id="ps-ask-panel" className="ps-ask" role="dialog" aria-label="Parts desk assistant">
          <div className="ps-ask__hd">
            <Diamond size={10} />
            <b>Parts Desk</b>
            <span>No pricing online — quotes in writing</span>
          </div>

          <div className="ps-ask__log" ref={logRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={"ps-ask__msg " + m.role}>
                {m.text}
              </div>
            ))}
            {busy && <div className="ps-ask__msg desk busy">…</div>}
            {msgs.length === 1 && (
              <div className="ps-ask__sugs">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="ps-ask__bar"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Part number, machine, freight…"
              maxLength={500}
              aria-label="Your question"
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
