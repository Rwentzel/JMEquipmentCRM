/**
 * Operational backup of the live data directory.
 *
 *   npm run backup                       # snapshot .data/ -> .backups/
 *   npm run backup -- --out /mnt/vault   # snapshot elsewhere
 *   npm run backup -- --keep 30          # retain the 30 most recent
 *   npm run backup -- --list             # show what exists
 *   npm run backup -- --verify <file>    # re-check one archive
 *
 * `.data/` holds the RFQ inbox, the Quote Center store, and the audit log:
 * losing it loses real customer requests and live quotes. Schedule this
 * alongside `npm run retention` (see LAUNCH.md). Exits non-zero on failure so
 * a silent cron failure is impossible.
 *
 * ARCHIVES CONTAIN CUSTOMER PII AND QUOTE PRICING — store them encrypted and
 * off-box. `.backups/` is gitignored; never commit one.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { backupDir, dataDir, listBackups, parseArchive, pruneBackups, writeBackup } from "../src/lib/backup";

function arg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = backupDir(arg(args, "--out"));

  if (args.includes("--list")) {
    const files = await listBackups(outDir);
    if (files.length === 0) return console.log(`No backups in ${outDir}`);
    console.log(`${files.length} backup(s) in ${outDir}:`);
    for (const f of files) {
      const s = await stat(path.join(outDir, f));
      console.log(`  ${f}  ${(s.size / 1024).toFixed(1)} KB`);
    }
    return;
  }

  const toVerify = arg(args, "--verify");
  if (toVerify) {
    const file = path.resolve(toVerify);
    const { manifest } = parseArchive(await readFile(file), file);
    console.log(`OK  ${toVerify}`);
    console.log(`    taken ${manifest.createdAt} from ${manifest.source}`);
    for (const f of manifest.files) console.log(`    ${f.name}  ${f.size} bytes  ${f.sha256.slice(0, 12)}`);
    return;
  }

  const keep = Number(arg(args, "--keep") ?? process.env.JME_BACKUP_KEEP ?? "14");
  if (!Number.isFinite(keep) || keep < 1) {
    console.error("--keep must be a positive number");
    process.exitCode = 2;
    return;
  }

  const source = dataDir();
  const { file, entries } = await writeBackup(source, outDir);
  const size = (await stat(file)).size;

  console.log(`Backed up ${entries.length} file(s) from ${source}`);
  for (const e of entries) console.log(`  ${e.name}  ${e.size} bytes  ${e.sha256.slice(0, 12)}`);
  console.log(`-> ${file}  (${(size / 1024).toFixed(1)} KB, verified)`);

  const pruned = await pruneBackups(outDir, keep);
  if (pruned.length > 0) console.log(`Pruned ${pruned.length} old backup(s), keeping ${keep}.`);
  console.log("\nArchives contain customer PII and quote pricing — store them encrypted and off-box.");
}

main().catch((err: unknown) => {
  console.error(`BACKUP FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
