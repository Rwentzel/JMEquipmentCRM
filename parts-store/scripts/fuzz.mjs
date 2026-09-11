/**
 * Fuzz harness — launch gate E1's "fuzz harness clean, 3+ seeds × 140 steps".
 *
 * Drives the built app with seeded random interactions and fails on any
 * uncaught page error or console error. Every seed is reproducible: the same
 * seed replays the same walk, so a crash found in CI is a crash you can
 * watch locally with the seed it prints.
 *
 *   npm run fuzz -- http://127.0.0.1:3100 --seeds=3 --steps=140
 *
 * With OPS_TOKEN set the staff surfaces (ops desk, Quote Center) are in the
 * walk too — run it against a server with a throwaway RFQ_DATA_DIR, since
 * the walk saves, deletes and sends whatever it can reach.
 */
import { launchBrowser } from "./browser.mjs";
import { mintQuotePath, staffCookie } from "./quoteLink.mjs";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || process.env.FUZZ_BASE || "http://localhost:3000").replace(/\/$/, "");
const num = (name, def) => Number((args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1] || process.env[`FUZZ_${name.toUpperCase()}`] || def);
const SEEDS = num("seeds", 3);
const STEPS = num("steps", 140);
const FIRST_SEED = num("seed", 1);
const OPS_TOKEN = process.env.OPS_TOKEN;

const CUSTOMER = ["/", "/machines", "/machine/JME-VCS12-75", "/support", "/how-quoting-works", "/parts/goodstrong/1650", "/compare"];
const STAFF = ["/ops", "/quotes", "/quotes/builder", "/quotes/equipment", "/quotes/parts", "/quotes/clients"];
const DESKTOP = { viewport: { width: 1440, height: 1000 } };
const MOBILE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

// Off-site hand-offs are not the app's to survive: mail, phone, downloads,
// new tabs. Everything else on the page is fair game.
const TARGETS = "a[href]:not([href^='mailto:']):not([href^='tel:']):not([target='_blank']):not([download]), button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=button], [role=tab], summary";
const FIELDS = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled])";
const WORDS = ["blade", "1650", "SN-26218", "JME-VCS-BLD-001", "bearing", "", "<script>x</script>", "'; drop", "999999", "pat@example.test", "Ω≈ç√", "0", "-1", "Goodstrong"];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

/**
 * Pick one visible element matching `selector` in a single round trip: the
 * page filters and chooses (with the harness's random draw), tags it
 * data-fuzz, and returns its tag name — or null when nothing is visible.
 * One evaluate instead of one isVisible() per candidate, which on the
 * catalog page was a few hundred round trips per step.
 */
async function mark(page, selector, draw) {
  return page.evaluate(
    ([sel, d]) => {
      document.querySelectorAll("[data-fuzz]").forEach((e) => e.removeAttribute("data-fuzz"));
      const visible = [...document.querySelectorAll(sel)].filter((e) => {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      });
      if (!visible.length) return null;
      const el = visible[Math.floor(d * visible.length)];
      el.setAttribute("data-fuzz", "1");
      return el.tagName;
    },
    [selector, draw],
  );
}

const origin = new URL(BASE).origin;
const browser = await launchBrowser();
let failed = 0;
const cookie = OPS_TOKEN ? await staffCookie(BASE, OPS_TOKEN) : null;
// With the desk's token the walk also gets a real customer quote link — the
// page a buyer opens, with its typed-signature accept flow — and the staff
// surfaces behind the login.
const SURFACES = cookie ? [...CUSTOMER, await mintQuotePath(BASE, cookie, "Fuzz harness"), ...STAFF] : CUSTOMER;

for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS; seed++) {
  const r = rng(seed);
  const context = await browser.newContext(r() < 0.5 ? DESKTOP : MOBILE);
  if (cookie) await context.addCookies([{ name: "jme_ops", value: cookie, url: BASE }]);
  // Keep the walk on this origin; nothing outside it is under test.
  await context.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  const page = await context.newPage();
  page.on("popup", (p) => p.close().catch(() => {}));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  const errors = [];
  page.on("pageerror", (e) => errors.push(`step ${step}: ${e.message.split("\n")[0]}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`step ${step}: console: ${m.text().split("\n")[0].slice(0, 160)}`);
  });
  let step = 0;
  let actions = 0;
  const started = Date.now();
  try {
    await page.goto(BASE + pick(r, SURFACES), { waitUntil: "networkidle" });
    for (step = 1; step <= STEPS; step++) {
      const roll = r();
      try {
        if (roll < 0.06 || !page.url().startsWith(origin)) {
          await page.goto(BASE + pick(r, SURFACES), { waitUntil: "domcontentloaded" });
        } else if (roll < 0.14) {
          await page.keyboard.press(pick(r, ["Escape", "Tab", "Enter", "Space", "ArrowDown", "Shift+Tab"]));
        } else if (roll < 0.2) {
          await page.mouse.wheel(0, Math.round((r() - 0.3) * 1600));
        } else if (roll < 0.4) {
          if (await mark(page, FIELDS, r())) {
            const f = page.locator("[data-fuzz]");
            await f.fill(pick(r, WORDS), { timeout: 1500 });
            if (r() < 0.3) await f.press("Enter", { timeout: 1500 });
          }
        } else {
          const tag = await mark(page, TARGETS, r());
          if (tag) {
            const el = page.locator("[data-fuzz]");
            if (tag === "SELECT") {
              const opts = await el.locator("option").evaluateAll((os) => os.map((o) => o.value));
              if (opts.length) await el.selectOption(pick(r, opts), { timeout: 1500 });
            } else {
              await el.click({ timeout: 1500, force: r() < 0.2 });
            }
          }
        }
        actions++;
      } catch (err) {
        // A detached node, an obscured target, a navigation mid-click: the
        // walk moves on. Only what the page itself reports is a failure.
        if (!/Timeout|detached|not visible|intercepts pointer|Navigation|closed|not attached|outside of the viewport|Malformed value/i.test(err.message)) {
          errors.push(`step ${step}: harness: ${err.message.split("\n")[0].slice(0, 160)}`);
        }
      }
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
  } catch (err) {
    errors.push(`seed ${seed}: ${err.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (errors.length) {
    failed++;
    console.log(`FAIL  seed ${seed} — ${errors.length} error(s) in ${STEPS} steps (${actions} actions, ${secs}s)`);
    for (const e of errors.slice(0, 10)) console.log(`        ${e}`);
  } else {
    console.log(`PASS  seed ${seed} — ${STEPS} steps clean (${actions} actions, ${secs}s)`);
  }
}

await browser.close();
if (failed) {
  console.log(`\nFAIL  ${failed} of ${SEEDS} seed(s) hit errors. Replay one with --seed=<n> --seeds=1.`);
  process.exit(1);
}
console.log(`\nPASS  fuzz clean — ${SEEDS} seeds × ${STEPS} steps, no page or console errors${cookie ? " (customer and staff surfaces)" : " (customer surfaces; set OPS_TOKEN for staff)"}.`);
