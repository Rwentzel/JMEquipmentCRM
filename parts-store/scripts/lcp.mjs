/**
 * Mobile performance gate (BUILD_PROMPT.md): Largest Contentful Paint under
 * 2.5 s on a phone. Measured through Chromium with Lighthouse's "slow 4G"
 * network profile (1.6 Mbps down, 750 kbps up, 150 ms RTT) and a 4× CPU
 * slowdown, on a 390×844 viewport.
 *
 *   node scripts/lcp.mjs http://127.0.0.1:3000
 *
 * Prints one row per page and exits 1 when any page misses the gate.
 * Numbers from a laptop or a CI runner are indicative, not a field
 * measurement: the server is local, so time-to-first-byte is near zero.
 */
import { launchBrowser } from "./browser.mjs";

const BASE = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const GATE_MS = 2500;
const PAGES = ["/", "/machines", "/support", "/how-quoting-works", "/machine/JME-VCS12-75", "/parts/goodstrong"];

const browser = await launchBrowser();
const rows = [];
for (const path of PAGES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = { ms: 0, el: "" };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__lcp = { ms: e.startTime, el: e.element ? e.element.tagName.toLowerCase() + (e.element.className ? "." + String(e.element.className).split(" ")[0] : "") : "" };
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const { ms, el } = await page.evaluate(() => window.__lcp);
  const kb = await page.evaluate(() =>
    Math.round(
      performance.getEntriesByType("resource").reduce((s, r) => s + (r.transferSize || 0), performance.getEntriesByType("navigation")[0]?.transferSize || 0) / 1024,
    ),
  );
  rows.push({ path, ms: Math.round(ms), el, kb });
  await context.close();
}
await browser.close();

let missed = 0;
for (const r of rows) {
  const flag = r.ms > GATE_MS ? "MISS" : "ok  ";
  if (r.ms > GATE_MS) missed++;
  console.log(`${flag}  ${String(r.ms).padStart(5)} ms  ${String(r.kb).padStart(4)} KB  ${r.path}  (${r.el})`);
}
console.log(missed ? `\nFAIL  ${missed} page(s) over ${GATE_MS} ms LCP on the slow-4G mobile profile` : `\nPASS  every page under ${GATE_MS} ms LCP on the slow-4G mobile profile`);
process.exit(missed ? 1 : 0);
