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
 *   npm ci (playwright-core and axe-core are dev dependencies)
 *   node scripts/a11y-audit.mjs [baseUrl]   # default http://localhost:3000
 *
 * Set OPS_TOKEN to the running server's token and the staff surfaces — the ops
 * desk and every Quote Center screen — are audited too. Without it they are
 * skipped with a notice rather than silently passing: they went unaudited for
 * their whole life that way, and were carrying 39 unlabelled form controls.
 * With the token the audit also mints a real quote (storefront request, then
 * the desk's from-rfq call) and audits the customer's share-link page.
 *
 * Exits non-zero if any violation is found, so it can gate a release when a
 * browser is available in the runner.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mintQuotePath, staffCookie } from "./quoteLink.mjs";

const BASE = process.argv[2] || process.env.A11Y_BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);

let launchBrowser, axeSource;
try {
  ({ launchBrowser } = await import("./browser.mjs"));
  axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
} catch {
  console.error("Missing tooling. Run:  npm ci (playwright-core and axe-core are dev dependencies)");
  process.exit(2);
}

// WCAG 2.1 AA plus 2.2 AA and axe's best-practice rules (heading order, one
// h1 per page, landmarks, empty table headers): the checks a screen-reader
// walkthrough would make by hand.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const ROUTES = [
  "/", "/machines", "/support", "/how-quoting-works", "/compare", "/freight", "/terms", "/privacy",
  "/machine/JME-VCS12-75", "/parts/goodstrong", "/parts/goodstrong/1600e",
];
/** Staff surfaces. Gated by OPS_TOKEN, so they need a session cookie to reach. */
const STAFF_ROUTES = [
  "/ops",
  "/quotes", "/quotes/pipeline", "/quotes/builder",
  "/quotes/equipment", "/quotes/parts", "/quotes/clients",
  "/quotes/analytics", "/quotes/settings",
];

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const browser = await launchBrowser();

let failures = 0;

async function audit(label, route, setup, viewport = DESKTOP, opsCookie = null) {
  const page = await browser.newPage({ viewport });
  if (opsCookie) {
    await page.context().addCookies([
      { name: "jme_ops", value: opsCookie, url: BASE },
    ]);
  }
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

// Tap targets. The brief's floor is 44 px on phones; the stylesheet that
// delivers it (styles/touch.css) is scoped to (pointer: coarse), so the
// check runs in a touch context. Inline links in running text are exempt,
// as WCAG 2.5.8 exempts them; a checkbox inside its label is measured by
// the label; a link whose hit area is widened with a pseudo-element
// counts that box, which is what the finger actually lands on.
async function auditTargets(route) {
  const ctx = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const small = await page.evaluate(() => {
      const MIN = 44;
      const out = [];
      const els = document.querySelectorAll(
        "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary",
      );
      for (const el of els) {
        if (el.closest("[aria-hidden='true']") || el.tabIndex < 0 && el.tagName !== "A") continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        let box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (el.tagName === "A" && cs.display === "inline" && el.closest("p,li,td,dd,small,figcaption,label,address,span")) continue;
        if ((el.type === "checkbox" || el.type === "radio") && el.closest("label")) {
          box = el.closest("label").getBoundingClientRect();
        }
        let w = box.width;
        let h = box.height;
        for (const pseudo of ["::before", "::after"]) {
          const ps = getComputedStyle(el, pseudo);
          if (ps.content !== "none" && ps.position === "absolute") {
            w = Math.max(w, parseFloat(ps.width) || 0);
            h = Math.max(h, parseFloat(ps.height) || 0);
          }
        }
        if (w < MIN || h < MIN) {
          const name = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32);
          out.push(`${Math.round(w)}x${Math.round(h)} ${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} "${name}"`);
        }
      }
      return out;
    });
    if (small.length === 0) {
      console.log(`PASS  tap targets ${route}`);
    } else {
      failures += 1;
      console.log(`FAIL  tap targets ${route} — ${small.length} under 44 px`);
      for (const line of small.slice(0, 12)) console.log(`          ${line}`);
    }
  } catch (err) {
    failures += 1;
    console.log(`ERROR tap targets ${route} — ${err.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

for (const route of ROUTES) await auditTargets(route);

// Static routes, desktop and mobile.
for (const route of ROUTES) await audit(`route ${route}`, route);
await audit("route / (mobile)", "/", null, MOBILE);

// Interactive states.
/**
 * Refuse to audit a staff route that is really the login form.
 *
 * Without this, an auth change that this script has not kept up with turns
 * every staff route into a two-field login page — which passes cleanly, and
 * reports that eight screens nobody looked at are fine.
 */
const assertAuthed = async (page) => {
  if (await page.$("#ops-token")) {
    throw new Error("not authenticated — the login succeeded but the app did not accept the session on this route");
  }
};

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

/**
 * Get a staff session by logging in the way a person does.
 *
 * This script used to mint the cookie itself, mirroring issueSession(). When
 * the session format changed the copy drifted, the app rejected the cookie,
 * and every staff route quietly rendered the login form — which passes, so the
 * run reported eight screens nobody had looked at as clean. Asking the real
 * endpoint removes the duplicated crypto altogether: there is no second
 * implementation left to drift. assertAuthed stays as the backstop.
 */
// Staff surfaces.
if (process.env.OPS_TOKEN) {
  try {
    const cookie = await staffCookie(BASE, process.env.OPS_TOKEN);
    for (const route of STAFF_ROUTES) await audit(`route ${route}`, route, assertAuthed, DESKTOP, cookie);
  } catch (err) {
    failures += 1;
    console.log(`ERROR staff routes — ${err.message}`);
  }
} else {
  console.log(`\nSKIP  ${STAFF_ROUTES.length} staff routes — set OPS_TOKEN to audit /ops and the Quote Center.`);
}

// The customer's quote page needs a real id and capability token. With the
// staff token in hand the audit mints one itself: a storefront request, then
// the desk's "turn this into a quote" call, then the share link the desk would
// send. Without the token, pass a path from a server that has one:
//   A11Y_QUOTE_PATH=/q/<id>/<token> node scripts/a11y-audit.mjs
// It is the page the buyer opens and prints, so it is worth the extra step.
let quotePath = process.env.A11Y_QUOTE_PATH || null;
if (!quotePath && process.env.OPS_TOKEN) {
  try {
    quotePath = await mintQuotePath(BASE, await staffCookie(BASE, process.env.OPS_TOKEN), "Accessibility audit");
  } catch (err) {
    failures += 1;
    console.log(`ERROR client quote page — could not mint a quote to audit: ${err.message}`);
  }
}
if (quotePath) {
  await audit("client quote link", quotePath);
  await audit("client quote link (mobile)", quotePath, null, MOBILE);
  // The buyer opens this on a phone as often as not: the 44 px floor applies.
  await auditTargets(quotePath);
} else {
  console.log("\nSKIP  client quote page — set OPS_TOKEN (the audit mints a quote) or A11Y_QUOTE_PATH=/q/<id>/<token>.");
}

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} accessibility violation type(s) found.`);
  process.exit(1);
}
const staffCount = process.env.OPS_TOKEN ? STAFF_ROUTES.length : 0;
const quoteCount = quotePath ? 2 : 0;
console.log(
  `\nPASS  no WCAG 2.2 AA or best-practice violations across ${ROUTES.length + 5 + staffCount + quoteCount} page states; tap targets 44 px on ${ROUTES.length + (quotePath ? 1 : 0)} customer routes.`,
);
