import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import test, { after, before } from "node:test";

/**
 * The RFQ Worker (design_handoff_jme_platform/deploy/worker/rfq-worker.js)
 * is the one endpoint both tracks submit to. Launch gate E1 asks for its
 * smoke tests — 422 / 200 / 429 / honeypot, per request type — and until now
 * they could only run against a deployed Worker. This drives the module's
 * fetch handler in-process with a KV stub and a Resend stub, so the gate
 * runs on every push with everything else.
 */
const WORKER = join(process.cwd(), "..", "design_handoff_jme_platform", "deploy", "worker", "rfq-worker.js");

type Env = {
  RATE_LIMIT_KV: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: unknown) => Promise<void> };
  RESEND_KEY: string;
  RFQ_FROM: string;
  RFQ_TO: string;
  ALLOW_ORIGIN?: string;
};

let worker: { fetch: (req: Request, env: Env, ctx: unknown) => Promise<Response> };
const realFetch = globalThis.fetch;
let sent: Array<{ url: string; body: Record<string, unknown> }> = [];
let resendStatus = 200;

before(async () => {
  worker = (await import(pathToFileURL(WORKER).href)).default;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(resendStatus === 200 ? '{"id":"stub"}' : "nope", { status: resendStatus });
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

function env(overrides: Partial<Env> = {}, count = 0): Env {
  const store = new Map<string, string>();
  if (count) store.set("rl:203.0.113.9", String(count));
  return {
    RATE_LIMIT_KV: {
      get: async (k) => store.get(k) ?? null,
      put: async (k, v) => {
        store.set(k, v);
      },
    },
    RESEND_KEY: "test-key",
    RFQ_FROM: "noreply@jmequipment.net",
    RFQ_TO: "parts@jmequipment.net",
    ALLOW_ORIGIN: "https://jmequipment.net,https://parts.jmequipment.net",
    ...overrides,
  };
}

function post(body: unknown, origin = "https://parts.jmequipment.net"): Request {
  return new Request("https://rfq.example/api/rfq", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": "203.0.113.9" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID: Record<string, Record<string, unknown>> = {
  "parts-rfq": { name: "Pat", email: "pat@example.test", part_number: "JME-VCS-BLD-001", quantity: 2 },
  "manual-request": { email: "pat@example.test", serial: "SN-26218" },
  "service-request": { name: "Pat", phone: "269-555-0100", notes: "Hydraulic noise under load" },
  "fitment-check": { email: "pat@example.test", part_number: "JME-VCS-BLD-001", machine_model: "GMC-TC II 1650" },
  "epc-lookup": { email: "pat@example.test", serial: "SN-26218" },
  "sales-inquiry": { name: "Pat", email: "pat@example.test" },
};

test("preflight echoes an Origin on the comma-separated allow list, and only those", async () => {
  const listed = await worker.fetch(new Request("https://rfq.example/api/rfq", { method: "OPTIONS", headers: { Origin: "https://parts.jmequipment.net" } }), env(), {});
  assert.equal(listed.status, 204);
  assert.equal(listed.headers.get("Access-Control-Allow-Origin"), "https://parts.jmequipment.net");
  assert.equal(listed.headers.get("Vary"), "Origin");

  const stranger = await worker.fetch(new Request("https://rfq.example/api/rfq", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env(), {});
  assert.equal(stranger.headers.get("Access-Control-Allow-Origin"), "https://jmequipment.net");

  const unset = await worker.fetch(new Request("https://rfq.example/api/rfq", { method: "OPTIONS", headers: { Origin: "https://jmequipment.net" } }), env({ ALLOW_ORIGIN: undefined }), {});
  assert.equal(unset.headers.get("Access-Control-Allow-Origin"), "https://jmequipment.net");
});

test("anything but POST is 405; a body that is not JSON is 400", async () => {
  const get = await worker.fetch(new Request("https://rfq.example/api/rfq", { headers: { Origin: "https://jmequipment.net" } }), env(), {});
  assert.equal(get.status, 405);
  const bad = await worker.fetch(post("{not json"), env(), {});
  assert.equal(bad.status, 400);
});

test("a filled honeypot is a 422 whatever else the payload says", async () => {
  sent = [];
  const res = await worker.fetch(post({ ...VALID["parts-rfq"], honeypot: "http://spam" }), env(), {});
  assert.equal(res.status, 422);
  const json = (await res.json()) as { details: string[] };
  assert.ok(json.details.includes("honeypot triggered"));
  assert.equal(sent.length, 0, "the honeypot payload reached Resend");
});

for (const [type, valid] of Object.entries(VALID)) {
  test(`${type}: a missing-field payload is 422 with per-type details; a valid one is 200 with a reference`, async () => {
    sent = [];
    const empty = await worker.fetch(post({ request_type: type }), env(), {});
    assert.equal(empty.status, 422);
    const detail = (await empty.json()) as { request_type: string; details: string[] };
    assert.equal(detail.request_type, type);
    assert.ok(detail.details.length > 0, "no details for the empty payload");

    const ok = await worker.fetch(post({ request_type: type, ...valid }), env(), {});
    assert.equal(ok.status, 200);
    const json = (await ok.json()) as { status: string; request_type: string; reference_id: string };
    assert.equal(json.status, "success");
    assert.equal(json.request_type, type);
    const prefix = type === "parts-rfq" ? "RFQ" : "REQ";
    assert.match(json.reference_id, new RegExp(`^${prefix}-\\d{8}-[0-9A-Z]{4}$`));
    assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://parts.jmequipment.net");

    assert.equal(sent.length, 1, "exactly one email per accepted request");
    const mail = sent[0]!.body as { to: string; from: string; subject: string; text: string };
    assert.equal(mail.to, "parts@jmequipment.net");
    assert.equal(mail.from, "noreply@jmequipment.net");
    assert.ok(mail.subject.startsWith(json.reference_id));
    assert.ok(mail.text.includes(`Reference: ${json.reference_id}`));
    assert.doesNotMatch(mail.text, /\$\s?\d/, "a price in the desk email");
  });
}

test("an unknown request_type falls back to parts-rfq so old storefront payloads still work", async () => {
  const res = await worker.fetch(post({ request_type: "mystery", ...VALID["parts-rfq"] }), env(), {});
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { request_type: string }).request_type, "parts-rfq");
});

test("parts-rfq needs a quantity of at least 1 and a well-formed email", async () => {
  const qty = await worker.fetch(post({ ...VALID["parts-rfq"], quantity: 0 }), env(), {});
  assert.equal(qty.status, 422);
  assert.ok(((await qty.json()) as { details: string[] }).details.includes("quantity must be >= 1"));
  const mail = await worker.fetch(post({ ...VALID["parts-rfq"], email: "not-an-email" }), env(), {});
  assert.equal(mail.status, 422);
  assert.ok(((await mail.json()) as { details: string[] }).details.includes("valid email required"));
});

test("the eleventh request from one address in the hour is 429", async () => {
  sent = [];
  const res = await worker.fetch(post(VALID["parts-rfq"]), env({}, 11), {});
  assert.equal(res.status, 429);
  assert.equal(sent.length, 0);
});

test("a Resend failure is a 500, never a false success reference", async () => {
  resendStatus = 500;
  try {
    const res = await worker.fetch(post(VALID["parts-rfq"]), env(), {});
    assert.equal(res.status, 500);
    const json = (await res.json()) as { reference_id?: string; error: string };
    assert.equal(json.reference_id, undefined);
  } finally {
    resendStatus = 200;
  }
});
