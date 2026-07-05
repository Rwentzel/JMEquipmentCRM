"use client";

import { useCallback, useEffect, useState } from "react";
import { Diamond } from "@/components/ui";
import type { RfqStatus, StoredRfq } from "@/lib/rfqStore";
import type { MaintenanceReport } from "@/lib/agents/maintenanceAgent";
import type { SecurityReport } from "@/lib/agents/securityAgent";
import type { TriageReport } from "@/lib/agents/triageAgent";

/**
 * Ops desk console — RFQ inbox + built-in agents.
 *
 * This is the only UI that renders stored RFQ contact details; it sits
 * behind the ops session gate and is noindexed. Agent panels call the ops
 * agents API; with no AI key configured they run deterministic engines.
 */

const STATUSES: RfqStatus[] = ["new", "reviewing", "quoted", "won", "lost", "archived"];

type AgentName = "triage" | "maintenance" | "security";

interface AgentState {
  busy: boolean;
  triage?: TriageReport;
  maintenance?: MaintenanceReport;
  security?: SecurityReport;
}

function ageLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function OpsClient({ devOpen }: { devOpen: boolean }) {
  const [rfqs, setRfqs] = useState<StoredRfq[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentState>({ busy: false });
  const [tab, setTab] = useState<AgentName>("triage");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/rfqs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRfqs(data.rfqs ?? []);
      setCounts(data.counts ?? {});
      setLoadErr(null);
    } catch {
      setLoadErr("Could not load the RFQ inbox.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(ref: string, status: RfqStatus) {
    const prev = rfqs;
    setRfqs((rs) => rs.map((r) => (r.ref === ref ? { ...r, status } : r)));
    try {
      const res = await fetch("/api/ops/rfqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, status }),
      });
      if (!res.ok) throw new Error();
      void load();
    } catch {
      setRfqs(prev); // roll back optimistic update
    }
  }

  async function runAgent(agent: AgentName) {
    setTab(agent);
    setAgents((a) => ({ ...a, busy: true }));
    try {
      const res = await fetch("/api/ops/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.report) {
        setAgents((a) => ({ ...a, busy: false, [agent]: data.report }));
      } else {
        setAgents((a) => ({ ...a, busy: false }));
      }
    } catch {
      setAgents((a) => ({ ...a, busy: false }));
    }
  }

  async function logout() {
    await fetch("/api/ops/session", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="ops">
      <header className="ops__hd">
        <Diamond size={14} />
        <b>JM Equipment · Ops Desk</b>
        <span className="ops__hd-note">internal — RFQ inbox &amp; automation</span>
        {devOpen ? (
          <span className="ops__devbadge" title="Set OPS_TOKEN to require login">DEV MODE — no token set</span>
        ) : (
          <button className="ops__logout" onClick={logout}>Sign out</button>
        )}
      </header>

      <section className="ops__counts" aria-label="Queue counts">
        {STATUSES.map((s) => (
          <div key={s} className={"ops__count" + ((counts[s] ?? 0) > 0 ? " on" : "")}>
            <b>{counts[s] ?? 0}</b>
            <span>{s}</span>
          </div>
        ))}
      </section>

      <section className="ops__inbox" aria-label="RFQ inbox">
        <div className="ops__sechd">
          <h2>RFQ inbox</h2>
          <button onClick={() => void load()}>Refresh</button>
        </div>
        {loadErr && <p className="ops__err" role="alert">{loadErr}</p>}
        {!loadErr && rfqs.length === 0 && (
          <p className="ops__empty">No requests yet. Submissions from the storefront land here instantly.</p>
        )}
        {rfqs.length > 0 && (
          <div className="ops__tablewrap">
            <table className="ops__table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Age</th>
                  <th>Company / contact</th>
                  <th>Lines</th>
                  <th>Flags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => (
                  <tr key={r.ref}>
                    <td className="mono">{r.ref}</td>
                    <td>{ageLabel(r.createdAt)}</td>
                    <td>
                      <b>
                        {r.contact.company}
                        {r.contact.wantsAccount === false && <span className="ops__flag" title="Opted out of an account">NO ACCT</span>}
                      </b>
                      <small>
                        {r.contact.name}
                        {r.contact.lastName ? ` ${r.contact.lastName}` : ""} · {r.contact.email}
                        {r.contact.phone ? ` · ${r.contact.phone}${r.contact.phoneExt ? ` ext. ${r.contact.phoneExt}` : ""}` : ""}
                        {r.contact.serial ? ` · S/N ${r.contact.serial}` : ""}
                      </small>
                      {r.contact.shipAddress && (
                        <small className="ops__addr">
                          Ship: {r.contact.shipAddress}
                          {r.contact.billingSameAsShipping === false && r.contact.billingAddress
                            ? ` · Bill: ${r.contact.billingAddress}`
                            : ""}
                        </small>
                      )}
                      {r.message && <small className="ops__msg">&ldquo;{r.message}&rdquo;</small>}
                    </td>
                    <td>
                      {r.items.map((it) => (
                        <span key={it.sku} className="ops__line mono">
                          {it.sku}×{it.qty}
                        </span>
                      ))}
                    </td>
                    <td>{r.freight && <span className="ops__flag">FREIGHT</span>}</td>
                    <td>
                      <select
                        value={r.status}
                        onChange={(e) => void setStatus(r.ref, e.target.value as RfqStatus)}
                        aria-label={`Status for ${r.ref}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ops__agents" aria-label="Automation agents">
        <div className="ops__sechd">
          <h2>Agents</h2>
          <div className="ops__agentbtns">
            <button onClick={() => void runAgent("triage")} disabled={agents.busy}>Triage queue</button>
            <button onClick={() => void runAgent("maintenance")} disabled={agents.busy}>Run health checks</button>
            <button onClick={() => void runAgent("security")} disabled={agents.busy}>Security scan</button>
          </div>
        </div>

        {agents.busy && <p className="ops__empty">Running {tab} agent…</p>}

        {!agents.busy && tab === "triage" && agents.triage && (
          <div className="ops__report">
            <p className="ops__briefing">
              {agents.triage.briefing} <em>({agents.triage.engine === "ai" ? "AI briefing" : "rules engine"})</em>
            </p>
            <ol>
              {agents.triage.queue.map((t) => (
                <li key={t.ref}>
                  <span className="mono">{t.ref}</span> — score {t.score}: {t.reasons.join("; ")}
                </li>
              ))}
            </ol>
          </div>
        )}

        {!agents.busy && tab === "maintenance" && agents.maintenance && (
          <div className="ops__report">
            <p className="ops__briefing">
              {agents.maintenance.ok ? "All checks passing." : "Attention needed — a check failed."}
            </p>
            <ul>
              {agents.maintenance.checks.map((c) => (
                <li key={c.name} className={c.ok ? "ok" : "bad"}>
                  <b>{c.ok ? "PASS" : "FAIL"}</b> {c.name} — {c.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!agents.busy && tab === "security" && agents.security && (
          <div className="ops__report">
            <p className="ops__briefing">
              {agents.security.narrative} <em>({agents.security.engine === "ai" ? "AI summary" : "rules engine"})</em>
            </p>
            <ul>
              {agents.security.findings.map((f) => (
                <li key={f.title} className={f.severity === "info" ? "ok" : "bad"}>
                  <b>{f.severity.toUpperCase()}</b> {f.title} — {f.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
