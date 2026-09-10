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
  const ref = (await page.locator(".ps-sent").innerText()).match(/RFQ-[0-9A-F]{8}/)?.[0];
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
