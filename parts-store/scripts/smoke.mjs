/**
 * Browser smoke test — the customer flows that have to work, driven through
 * a real Chromium against a running build.
 *
 *   npm run build
 *   OPS_TOKEN=devtoken node scripts/serve-standalone.mjs &   # or any server
 *   OPS_TOKEN=devtoken node scripts/smoke.mjs http://127.0.0.1:3000
 *
 * Each flow is what a customer or the desk actually does: search from the
 * hero, submit a quote request, submit a Support Hub form and see it in the
 * ops inbox, pick a machine on the platform, hand a part to the fitment
 * form, send an unmatched serial to the desk, ask the assistant, open the
 * phone menu. No flow reaches a price; every submission ends in a reference.
 * OPS_TOKEN must match the server's for the inbox check.
 */
import { launchBrowser } from "./browser.mjs";

const BASE = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const OPS_TOKEN = process.env.OPS_TOKEN;
const PHONE = { width: 390, height: 844 };

const browser = await launchBrowser();
let failures = 0;
const results = [];

async function flow(name, fn, viewport) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Stage C gate: zero console errors. A hydration mismatch, a failed
  // resource or a React warning-as-error all land here, not in pageerror.
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().split("\n")[0].slice(0, 160)}`);
  });
  try {
    await fn(page, context);
    if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
    results.push(`PASS  ${name}`);
  } catch (err) {
    failures++;
    results.push(`FAIL  ${name} — ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await context.close();
  }
}

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await flow("hero search filters the catalog and ?q= deep-links it", async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill("#ps-hero-q", "blade");
  await page.click(".ps-hero__search button[type=submit]");
  await page.waitForTimeout(600);
  ok((await page.locator(".ps-cat__search").inputValue()) === "blade", "catalog box did not take the hero query");
  ok(/blade/i.test(await page.locator(".ps-row").first().innerText()), "first row is not a blade");
  await page.goto(`${BASE}/?q=bearing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  ok(/bearing/i.test(await page.locator(".ps-row").first().innerText()), "?q= did not filter to bearings");
  await page.goto(`${BASE}/?q=1650`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const hit = page.locator(".ps-cat__machine").first();
  ok((await hit.count()) === 1, "a machine-name query did not surface the machine");
  ok((await hit.getAttribute("href")) === "/machine/GMC-TCII-1650", "the machine hit does not link to the machine page");
});

await flow("a parts link pre-fills the list and a quote request returns a reference", async (page) => {
  await page.goto(`${BASE}/?parts=JME-VCS-BLD-001:2`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  ok((await page.locator(".ps-line").count()) === 1, "parts link did not add the line");
  await page.fill("#f-company", "Smoke Test Co");
  await page.fill("#f-first-name", "Smoke");
  await page.fill("#f-email", "smoke@example.test");
  await page.locator(".ps-check input[type=checkbox]").last().check();
  await page.click("text=Get a Quote");
  await page.waitForSelector(".ps-sent", { timeout: 10_000 });
  ok(/RFQ-[0-9A-F]{8}/.test(await page.locator(".ps-sent").innerText()), "no reference shown");
  ok(!/\$\s?\d/.test(await page.locator("body").innerText()), "a price appeared on the storefront");
});

await flow("a Support Hub form submits and the request reaches the ops inbox with its kind", async (page) => {
  await page.goto(`${BASE}/support?panel=manual`, { waitUntil: "networkidle" });
  ok((await page.locator("#sh-panel-title").textContent())?.trim() === "Request a manual", "?panel=manual did not open the form");
  await page.click("#support-panel button[type=submit]");
  await page.waitForTimeout(300);
  ok((await page.locator("#support-panel [role=alert]").count()) >= 3, "empty submit did not show field errors");
  await page.fill("#sf-manual-request-serial", "SN-26218");
  await page.selectOption("#sf-manual-request-model", "Goodstrong GMC-TC II 1650");
  await page.fill("#sf-manual-request-email", "smoke@example.test");
  await page.check("#support-panel input[type=checkbox]");
  await page.click("#support-panel button[type=submit]");
  await page.waitForSelector(".ps-sent", { timeout: 10_000 });
  // A support request is minted under REQ-, never RFQ-: the reorder path
  // only accepts RFQ- references, so a manual request can never be "reordered".
  const ref = (await page.locator(".ps-sent").innerText()).match(/REQ-[0-9A-F]{8}/)?.[0];
  ok(ref, "no reference shown");
  if (!OPS_TOKEN) return; // inbox check needs the server's token
  const login = await page.request.post(`${BASE}/api/ops/session`, { data: { token: OPS_TOKEN } });
  ok(login.ok(), `ops login failed (${login.status()}) — OPS_TOKEN must match the server's`);
  // The session cookie is Secure; send it by hand so the check also works
  // over plain http to 127.0.0.1, where a browser would withhold it.
  const cookie = (login.headers()["set-cookie"] || "").split(";")[0];
  ok(cookie.startsWith("jme_ops="), "ops login set no session cookie");
  const list = await (await page.request.get(`${BASE}/api/ops/rfqs`, { headers: { cookie } })).json();
  const rec = (list.rfqs || []).find((r) => r.ref === ref);
  ok(rec, `inbox has no record ${ref} (${(list.rfqs || []).length} records listed)`);
  ok(rec.kind === "manual-request", `inbox record kind is ${JSON.stringify(rec.kind)}`);
  ok(rec.details?.["Machine model"] === "Goodstrong GMC-TC II 1650", `inbox record details: ${JSON.stringify(rec.details)}`);
});

await flow("configurator ids never reach a screen or the desk; the desk gets the labels", async (page) => {
  // Owner ruling 2026-09-10: choices carry an internal id, never a coined
  // part number. The id may travel to the intake, but the customer only
  // ever sees labels and the desk only ever reads labels.
  await page.goto(`${BASE}/machine/JME-VCS12-75`, { waitUntil: "networkidle" });
  const ids = ["P1", "P3", "P4", "F75", "F90"]; // JME-VCS12-75 power + frame ids (details.ts)
  const noBare = (text, where) => {
    for (const id of ids) ok(!new RegExp(`(^|[^A-Za-z0-9])${id}(?![A-Za-z0-9])`).test(text), `${where} shows the internal id ${id}`);
  };
  noBare(await page.locator("body").innerText(), "machine page");
  await page.locator(".md-choice", { hasText: "460V" }).first().click();
  await page.locator(".md-choice", { hasText: "90" }).first().click();
  await page.waitForTimeout(200);
  noBare(await page.locator("body").innerText(), "machine page after choosing");
  await page.locator(".md-config__action button, .md-config button").first().click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/#request`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const line = await page.locator(".ps-line").first().innerText();
  ok(/460V/.test(line), `request list line lacks the chosen label: ${line}`);
  noBare(await page.locator("body").innerText(), "request list");
  await page.fill("#f-company", "Smoke Test Co");
  await page.fill("#f-first-name", "Smoke");
  await page.fill("#f-email", "smoke@example.test");
  await page.locator(".ps-check input[type=checkbox]").last().check();
  await page.click("text=Get a Quote");
  await page.waitForSelector(".ps-sent", { timeout: 10_000 });
  const ref = (await page.locator(".ps-sent").innerText()).match(/RFQ-[0-9A-F]{8}/)?.[0];
  ok(ref, "no reference shown");
  if (!OPS_TOKEN) return;
  const login = await page.request.post(`${BASE}/api/ops/session`, { data: { token: OPS_TOKEN } });
  ok(login.ok(), `ops login failed (${login.status()})`);
  const cookie = (login.headers()["set-cookie"] || "").split(";")[0];
  const list = await (await page.request.get(`${BASE}/api/ops/rfqs`, { headers: { cookie } })).json();
  const rec = (list.rfqs || []).find((r) => r.ref === ref);
  ok(rec, `inbox has no record ${ref}`);
  const cfg = (rec.items?.[0]?.config || []).join(" | ");
  ok(/Power: 5 HP \/ 460V 3Ø/.test(cfg), `desk config lacks the resolved power label: ${cfg}`);
  noBare(cfg, "desk config lines");
  const csv = await (await page.request.get(`${BASE}/api/ops/rfqs/export`, { headers: { cookie } })).text();
  const row = csv.split("\n").find((l) => l.startsWith(ref)) || "";
  ok(row.includes("460V"), "CSV row lacks the resolved label");
  noBare(row, "CSV row");
});

await flow("the Machine Platform shows only confirmed-fit parts, and an honest empty state", async (page) => {
  await page.goto(`${BASE}/machines?m=JME-VCS12-75`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  // The confirm-fitment list below reuses the row class; count only the fits.
  const rows = (await page.locator(".mp__rows .ps-row").count()) - (await page.locator(".mp__confirm .ps-row").count());
  ok(rows === 7, `splitter should list its seven confirmed parts, saw ${rows} (title: ${await page.locator(".mp__title").textContent()})`);
  await page.click('.mp__tile:has-text("JME-RR-16")');
  await page.waitForTimeout(300);
  ok((await page.locator(".mp__empty").count()) === 1, "RollRite should show the empty state");
  ok(new URL(page.url()).searchParams.get("m") === "JME-RR-16", "rail click did not write ?m=");
});

await flow("a machine page hands a part to the fitment form already filled in", async (page) => {
  await page.goto(`${BASE}/machine/JME-RR-16`, { waitUntil: "networkidle" });
  await page.locator('#parts a:has-text("Ask about fitment")').first().click();
  await page.waitForURL(/\/support\?/);
  await page.waitForTimeout(500);
  ok((await page.locator("#sf-fitment-check-sku").inputValue()).length > 0, "SKU was not seeded");
  ok((await page.locator("#sf-fitment-check-machine").inputValue()) === "JME RollRite Rollstand", "machine was not seeded");
});

await flow("an unmatched serial goes to the desk in one click", async (page) => {
  await page.goto(`${BASE}/parts/goodstrong`, { waitUntil: "networkidle" });
  await page.click("text=I know my serial number");
  await page.fill("[role=dialog] input", "ZX-99871");
  await page.click("text=Find my machine");
  await page.click("[role=dialog] a.jme-btn");
  await page.waitForURL(/\/support/);
  await page.waitForTimeout(500);
  ok((await page.locator("#sf-epc-lookup-serial").inputValue()) === "ZX-99871", "serial was not seeded");
});

await flow("the assistant answers with links and never a price", async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click(".ps-askbtn");
  await page.fill(".ps-ask__bar input", "How much is the 1650?");
  await page.press(".ps-ask__bar input", "Enter");
  await page.waitForFunction(() => document.querySelectorAll(".ps-ask__msg.desk:not(.busy)").length >= 2, null, { timeout: 15_000 });
  const last = page.locator(".ps-ask__msg.desk:not(.busy)").last();
  ok(!/\$\s?\d/.test(await last.innerText()), "the assistant showed a price");
  ok((await last.locator(".ps-ask__links a").count()) >= 1, "no links under the answer");
});

await flow("the RFQ Flow explainer walks four steps, answers its FAQ, and routes to the catalog", async (page) => {
  await page.goto(`${BASE}/how-quoting-works`, { waitUntil: "networkidle" });
  ok((await page.locator(".fl__step").count()) === 4, "the explainer does not show four steps");
  const faq = page.locator(".fl__faq details");
  ok((await faq.count()) >= 4, "the FAQ accordion is missing");
  ok(!(await faq.first().evaluate((d) => d.open)), "the first FAQ item starts open");
  await faq.first().locator("summary").click();
  ok(await faq.first().evaluate((d) => d.open), "the FAQ item did not open");
  ok(!/\$\s?\d/.test(await page.locator("body").innerText()), "a price appeared on the explainer");
  await page.click("text=Browse the catalog");
  await page.waitForURL(/\/#parts$/, { timeout: 10_000 });
  ok((await page.locator(".ps-row").count()) > 0, "the catalog did not load after the explainer's call to action");
});

await flow("a modal makes the page behind it inert, closes on Escape, and hands focus back", async (page) => {
  await page.goto(`${BASE}/parts/goodstrong`, { waitUntil: "networkidle" });
  const trigger = page.locator("text=I know my serial number");
  await trigger.click();
  const dialog = page.locator("[role=dialog][aria-modal=true]");
  await dialog.waitFor({ timeout: 5_000 });
  ok(await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null), "focus did not move into the dialog");
  ok(
    await page.evaluate(() => [...document.body.children].filter((c) => c.getAttribute("role") !== "dialog" && c.tagName !== "SCRIPT").every((c) => c.inert)),
    "the page behind the dialog is not inert",
  );
  await page.keyboard.press("Escape");
  ok((await dialog.count()) === 0, "Escape did not close the dialog");
  ok(await page.evaluate(() => [...document.body.children].every((c) => !c.inert)), "the page stayed inert after the dialog closed");
  ok(await trigger.evaluate((el) => el === document.activeElement), "focus did not return to the button that opened the dialog");
});

await flow("the phone menu starts closed and opens from the burger", async (page) => {
  await page.goto(`${BASE}/machines`, { waitUntil: "networkidle" });
  ok(!(await page.locator(".ps-nav__links").isVisible()), "menu open on load");
  ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0, "page scrolls sideways");
  await page.click(".ps-nav__burger");
  ok(await page.locator(".ps-nav__links").isVisible(), "burger did not open the menu");
}, PHONE);

await browser.close();
console.log(results.join("\n"));
if (failures) {
  console.log(`\nFAIL  ${failures} smoke flow(s) failed against ${BASE}`);
  process.exit(1);
}
console.log(`\nPASS  ${results.length} smoke flows against ${BASE}`);
