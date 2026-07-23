"use client";

import { useState } from "react";

/** Customer accept bar: typed signature + terms agreement → POST accept. */
export function AcceptPanel({ id, token, accepted, deskPhone, deskEmail }: { id: string; token: string; accepted: boolean; deskPhone: string; deskEmail: string }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(accepted);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="qview__accept qview__accept--done">
        Quote accepted — thank you. The desk will confirm next steps by email. Questions: {deskPhone} · {deskEmail}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !agree || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quote-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token, signedName: name.trim() }),
      });
      if (res.ok) setDone(true);
      else setError("Could not record acceptance — call the desk at " + deskPhone + ".");
    } catch {
      setError("Could not reach the server — call the desk at " + deskPhone + ".");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="qview__accept" onSubmit={submit}>
      <div className="qview__accept-fields">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name to sign" aria-label="Your full name" maxLength={120} />
        <label>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the terms &amp; conditions above
        </label>
      </div>
      <button type="submit" disabled={busy || !name.trim() || !agree}>{busy ? "Recording…" : "Accept Quotation"}</button>
      {error && <p role="alert" className="qview__err">{error}</p>}
      <button type="button" className="qview__print" onClick={() => window.print()}>Print / Save PDF</button>
    </form>
  );
}
