/**
 * Restore the data directory from an archive written by `npm run backup`.
 *
 *   npm run restore -- --list                       # what can I restore from?
 *   npm run restore -- --from <archive>             # dry run: print the plan
 *   npm run restore -- --from <archive> --apply     # do it
 *   npm run restore -- --latest --apply             # newest archive
 *
 * A restore runs during an incident, when judgement is worst, so this is
 * deliberately conservative: dry run by default; the archive is fully verified
 * before anything is touched (a bad archive fails while live data is still
 * intact); the current data directory is snapshotted first, so restoring the
 * wrong archive is itself recoverable; and each file is replaced atomically.
 *
 * Stop the app first — writing the store under a running server races with it.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  applyRestore, backupDir, dataDir, listBackups, parseArchive, planRestore, writeBackup,
} from "../src/lib/backup";

function arg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = backupDir();

  if (args.includes("--list")) {
    const files = await listBackups(dir);
    if (files.length === 0) return console.log(`No backups in ${dir}`);
    console.log(`${files.length} backup(s) in ${dir} (newest first):`);
    for (const f of files) {
      const s = await stat(path.join(dir, f));
      console.log(`  ${f}  ${(s.size / 1024).toFixed(1)} KB`);
    }
    return;
  }

  let from = arg(args, "--from");
  if (args.includes("--latest")) {
    const files = await listBackups(dir);
    if (files.length === 0) {
      console.error("No backups found.");
      process.exitCode = 2;
      return;
    }
    from = path.join(dir, files[0]!);
  }
  if (!from) {
    console.error("Usage: restore.ts --from <archive> [--apply]  |  --latest --apply  |  --list");
    process.exitCode = 2;
    return;
  }

  const file = path.resolve(from);
  const archive = parseArchive(await readFile(file), file);
  const target = dataDir();

  console.log(`Archive : ${file}`);
  console.log(`Taken   : ${archive.manifest.createdAt}  (from ${archive.manifest.source})`);
  console.log(`Target  : ${target}\n`);

  const plan = await planRestore(archive, target);
  for (const item of plan.items) {
    console.log(`  ${item.action === "overwrite" ? "OVERWRITE" : "CREATE   "} ${item.name}  (${item.size} bytes)`);
  }
  for (const name of plan.untouched) console.log(`  LEAVE     ${name}  (not in this archive)`);

  if (!args.includes("--apply")) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to restore.");
    console.log("Stop the app first: writing the store under a running server races with it.");
    return;
  }

  let safety: string | null = null;
  if (plan.items.some((i) => i.action === "overwrite") || plan.untouched.length > 0) {
    safety = (await writeBackup(target, path.join(dir, "pre-restore"))).file;
  }
  console.log(`\nSafety copy of current data: ${safety ?? "none (nothing would be overwritten)"}`);

  for (const name of await applyRestore(archive, target)) console.log(`  restored ${name}`);
  console.log(`\nRestored ${archive.entries.length} file(s). Restart the app.`);
}

main().catch((err: unknown) => {
  console.error(`RESTORE FAILED: ${err instanceof Error ? err.message : String(err)}`);
  console.error("Current data was left untouched unless a 'restored' line appears above.");
  process.exitCode = 1;
});
