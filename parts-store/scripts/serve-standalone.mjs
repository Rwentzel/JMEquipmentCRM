/**
 * Serve the production build the way the container does, for the browser
 * checks: copy the static chunks and public assets into the standalone
 * output, start its server, and wait until /api/health answers.
 *
 *   npm run build && node scripts/serve-standalone.mjs          # foreground
 *   PORT=3100 OPS_TOKEN=... node scripts/serve-standalone.mjs & # for CI
 *
 * The RFQ store is pointed at a throwaway directory unless RFQ_DATA_DIR is
 * set, so nothing a smoke run submits lands in a real inbox.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build. Run `npm run build` first.");
  process.exit(1);
}
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

const port = process.env.PORT || "3000";
const env = {
  ...process.env,
  PORT: port,
  HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
  RFQ_DATA_DIR: process.env.RFQ_DATA_DIR || mkdtempSync(path.join(tmpdir(), "jme-smoke-")),
};
const child = spawn(process.execPath, [path.join(standalone, "server.js")], { env, stdio: "inherit" });
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));

const base = `http://127.0.0.1:${port}`;
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    const res = await fetch(`${base}/api/health`);
    if (res.ok) break;
  } catch {
    /* not up yet */
  }
  if (Date.now() > deadline) {
    console.error(`Server did not answer on ${base} within 60s`);
    stop();
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`READY ${base}`);
