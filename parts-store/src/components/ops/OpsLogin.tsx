"use client";

import { useState } from "react";
import { Diamond } from "@/components/ui";

/** Token login for the ops desk. The token is sent once and never stored client-side. */
export function OpsLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ops-gate">
      <form className="ops-login" onSubmit={submit}>
        <div className="ops-login__hd">
          <Diamond size={14} />
          <b>Ops Desk</b>
        </div>
        <label htmlFor="ops-token">Access token</label>
        <input
          id="ops-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {error && <p className="ops-login__err" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !token.trim()}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
