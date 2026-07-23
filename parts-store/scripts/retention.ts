/**
 * PII retention sweep — archive and purge old, closed RFQs from the live store.
 *
 *   npm run retention -- --days 730            # dry run: report what would move
 *   npm run retention -- --days 730 --apply    # archive + purge for real
 *
 * Only terminal-status RFQs (won / lost / archived) older than the window are
 * touched; open work is never purged. Archives land as dated JSON files in the
 * data dir — move them to cold storage or delete per JM's retention policy.
 * Schedule monthly via cron alongside agent:security (see LAUNCH.md).
 */

import { sweepRetention } from "../src/lib/rfqStore";

async function main() {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf("--days");
  const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : Number(process.env.RFQ_RETENTION_DAYS);
  const apply = args.includes("--apply");

  if (!Number.isFinite(days) || days < 30) {
    console.error("Usage: retention.ts --days <N >= 30> [--apply]   (or set RFQ_RETENTION_DAYS)");
    process.exitCode = 2;
    return;
  }

  const result = await sweepRetention(days, apply);
  console.log(`${apply ? "APPLIED" : "DRY RUN"}  cutoff ${result.cutoff} (${days} days)`);
  console.log(`  expired closed RFQs: ${result.archived}   remaining in store: ${result.kept}`);
  if (result.archiveFile) console.log(`  archived to: ${result.archiveFile}`);
  if (!apply && result.archived > 0) console.log("  re-run with --apply to archive and purge.");
}

void main();
