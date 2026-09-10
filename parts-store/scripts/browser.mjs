/**
 * One way to get a Chromium for the browser scripts (smoke, a11y audit).
 *
 * Order: CHROMIUM_PATH if set; the Playwright-managed binary this
 * environment ships at /opt/pw-browsers/chromium when it exists; otherwise
 * the machine's Google Chrome via Playwright's "chrome" channel — which is
 * what GitHub's ubuntu runners have preinstalled, so CI downloads nothing.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

export async function launchBrowser() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit) return chromium.launch({ executablePath: explicit });
  if (existsSync("/opt/pw-browsers/chromium")) return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  return chromium.launch({ channel: "chrome" });
}
