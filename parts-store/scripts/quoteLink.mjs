/**
 * Staff session and a freshly minted customer quote link, for the browser
 * gates (a11y audit, fuzz harness). Both talk to the real endpoints: the
 * desk's login, a storefront request, the desk's "turn this into a quote",
 * and the share token read back from the state — so there is no second
 * implementation of the quote flow to drift.
 */

/** Log in to the ops desk; returns the jme_ops cookie value. */
export async function staffCookie(base, token) {
  const res = await fetch(`${base}/api/ops/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`ops login failed (${res.status}) — is OPS_TOKEN the one the server was started with?`);
  const setCookie = res.headers.getSetCookie?.().find((c) => c.startsWith("jme_ops=")) ?? "";
  const value = setCookie.split(";")[0]?.slice("jme_ops=".length);
  if (!value) throw new Error("ops login returned no jme_ops cookie");
  return value;
}

/** A storefront request, turned into a draft quote; returns /q/<id>/<token>. */
export async function mintQuotePath(base, cookie, who = "Browser gate") {
  const json = { "Content-Type": "application/json" };
  const staff = { ...json, cookie: `jme_ops=${cookie}` };
  const rfqRes = await fetch(`${base}/api/quote`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      contact: { company: who, name: "Gate run", email: "gate@example.test", consent: true },
      items: [{ sku: "JME-VCS-BLD-001", qty: 1 }],
    }),
  });
  const rfq = await rfqRes.json().catch(() => ({}));
  if (!rfqRes.ok || !rfq.ref) throw new Error(`storefront request failed (${rfqRes.status})`);
  const conv = await fetch(`${base}/api/qc/from-rfq`, { method: "POST", headers: staff, body: JSON.stringify({ ref: rfq.ref }) });
  const made = await conv.json().catch(() => ({}));
  if (!conv.ok || !made.id) throw new Error(`from-rfq failed (${conv.status})`);
  const stateRes = await fetch(`${base}/api/qc/state`, { headers: staff });
  const { state } = await stateRes.json();
  const quote = state?.quotes?.find((q) => q.id === made.id);
  if (!quote?.token) throw new Error("minted quote carries no share token");
  return `/q/${made.id}/${quote.token}`;
}
