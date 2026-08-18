/**
 * WCAG 2.1 AA accessibility audit (axe-core over a real browser).
 *
 * Covers both static routes and the interactive states where accessibility
 * problems actually hide — an open menu, an expanded filter rail, a populated
 * request list — because a clean first-paint scan proves very little on a site
 * whose catalog only renders after interaction.
 *
 * Deliberately not a project dependency: it needs a browser engine, which is
 * heavy and widens the dependency surface the CI audit gate has to police.
 * Install on demand instead.
 *
 *   npm run build && npm start &          # or: PORT=3000 npm start
 *   npm i --no-save playwright-core axe-core
 *   node scripts/a11y-audit.mjs [baseUrl]   # default http://localhost:3000
 *
 * Exits non-zero if any violation is found, so it can gate a release when a
 * browser is available in the runner.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const BASE = process.argv[2] || process.env.A11Y_BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);

let chromium, axeSource;
try {
  ({ chromium } = await import("playwright-core"));
  axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
} catch {
  console.error("Missing tooling. Run:  npm i --no-save playwright-core axe-core");
  process.exit(2);
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const ROUTES = [
  "/", "/compare", "/freight", "/terms", "/privacy",
  "/machine/JME-VCS12-75", "/parts/goodstrong", "/parts/goodstrong/1600e",
];
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
});

let failures = 0;

async function audit(label, route, setup, viewport = DESKTOP) {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    if (setup) await setup(page);
    await page.addScriptTag({ content: axeSource });
    const { violations } = await page.evaluate(
      async (tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
      TAGS,
    );
    if (violations.length === 0) {
      console.log(`PASS  ${label}`);
    } else {
      failures += violations.length;
      console.log(`FAIL  ${label} — ${violations.length} violation type(s)`);
      for (const v of violations) {
        console.log(`        [${v.impact}] ${v.id} — ${v.help}`);
        for (const n of v.nodes.slice(0, 4)) {
          const why = (n.failureSummary || "").split("\n").slice(1, 2).join("").trim();
          console.log(`          ${n.target.join(" ")}${why ? ` :: ${why}` : ""}`.slice(0, 200));
        }
      }
    }
  } catch (err) {
    failures += 1;
    console.log(`ERROR ${label} — ${err.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

// Static routes, desktop and mobile.
for (const route of ROUTES) await audit(`route ${route}`, route);
await audit("route / (mobile)", "/", null, MOBILE);

// Interactive states.
const click = (selector) => async (page) => {
  const el = await page.$(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  await el.click();
  await page.waitForTimeout(500);
};

await audit("assistant widget open", "/", click("#ask-toggle, .ps-askbtn"));
await audit("category rail open", "/", click(".ps-cat__railtoggle"), { width: 620, height: 900 });
await audit("mobile nav open", "/", click(".ps-nav__burger, .ps-nav__toggle, [aria-label*='menu' i]"), MOBILE);
await audit("request list populated", "/", async (page) => {
  await page.fill(".ps-cat__search", "blade");
  await page.waitForTimeout(500);
  const add = await page.$(".ps-row .jme-btn");
  if (add) await add.click();
  await page.waitForTimeout(400);
  const req = await page.$("#request");
  if (req) await req.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
});

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} accessibility violation type(s) found.`);
  process.exit(1);
}
console.log(`\nPASS  no WCAG 2.1 AA violations across ${ROUTES.length + 5} page states.`);
