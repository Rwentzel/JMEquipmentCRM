/**
 * Backup and restore for the file-backed data directory (`.data/`), which
 * holds the RFQ inbox, the Quote Center store, and the audit log.
 *
 * The logic lives here rather than in the scripts so it can be tested: backup
 * code that has never been exercised is precisely the code that fails on the
 * day it is needed. `scripts/backup.ts` and `scripts/restore.ts` are thin CLIs
 * over these functions.
 *
 * Two invariants shape the design:
 *
 *  - **Verified, not hopeful.** Every JSON/JSONL file is parsed before it is
 *    archived, and archives are re-parsed and re-hashed before they are written
 *    or restored. A snapshot of a corrupt store is worse than none, because it
 *    is trusted at the moment it matters.
 *  - **Never partial.** Archives and restored files are written to a temp name
 *    and renamed into place, so an interrupted run cannot leave something that
 *    looks like good data.
 *
 * Archives contain customer PII and internal quote pricing — store them
 * encrypted and off-box, under the same retention window as `npm run retention`.
 */

import { gunzipSync, gzipSync } from "node:zlib";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const ARCHIVE_FORMAT = 1;
export const ARCHIVE_PREFIX = "jme-data-";
export const ARCHIVE_SUFFIX = ".json.gz";

export interface ArchiveEntry {
  name: string;
  /** base64 of the original bytes */
  bytes: string;
  sha256: string;
  size: number;
}

export interface ArchiveManifest {
  format: number;
  createdAt: string;
  source: string;
  files: Omit<ArchiveEntry, "bytes">[];
}

export interface Archive {
  manifest: ArchiveManifest;
  entries: ArchiveEntry[];
}

export function dataDir(): string {
  return process.env.RFQ_DATA_DIR || path.join(process.cwd(), ".data");
}

export function backupDir(override?: string): string {
  return override || process.env.JME_BACKUP_DIR || path.join(process.cwd(), ".backups");
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Parse-check a store file. Throws with the file named, so a failure during a
 * backup says which store is corrupt rather than just "invalid JSON".
 */
export function validateStoreFile(name: string, buf: Buffer): void {
  const text = buf.toString("utf8");
  if (name.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (e) {
      throw new Error(`${name} is not valid JSON (${(e as Error).message})`);
    }
  } else if (name.endsWith(".jsonl")) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().length === 0) continue;
      try {
        JSON.parse(line);
      } catch {
        throw new Error(`${name} line ${i + 1} is not valid JSON`);
      }
    }
  }
}

/** Read every file in `dir`, validating known formats. */
export async function collectEntries(dir: string): Promise<ArchiveEntry[]> {
  let names: string[];
  try {
    names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    throw new Error(`data directory not found: ${dir}`);
  }
  if (names.length === 0) {
    throw new Error(`data directory is empty, refusing to write an empty backup: ${dir}`);
  }
  const entries: ArchiveEntry[] = [];
  for (const name of names.sort()) {
    const buf = await readFile(path.join(dir, name));
    validateStoreFile(name, buf);
    entries.push({ name, bytes: buf.toString("base64"), sha256: sha256(buf), size: buf.byteLength });
  }
  return entries;
}

export function buildArchive(entries: ArchiveEntry[], source: string, now = new Date()): Archive {
  return {
    manifest: {
      format: ARCHIVE_FORMAT,
      createdAt: now.toISOString(),
      source,
      files: entries.map(({ name, sha256: hash, size }) => ({ name, sha256: hash, size })),
    },
    entries,
  };
}

export function serializeArchive(archive: Archive): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(archive)), { level: 9 });
}

/**
 * Decompress, re-parse, re-hash, and re-validate. Throws on any inconsistency,
 * so callers can verify before touching live data.
 */
export function parseArchive(raw: Buffer, label = "archive"): Archive {
  let archive: Archive;
  try {
    archive = JSON.parse(gunzipSync(raw).toString("utf8")) as Archive;
  } catch (e) {
    throw new Error(`${label}: unreadable (${(e as Error).message})`);
  }
  if (archive?.manifest?.format !== ARCHIVE_FORMAT) throw new Error(`${label}: unrecognised archive format`);
  if (!Array.isArray(archive.entries) || archive.entries.length !== archive.manifest.files.length) {
    throw new Error(`${label}: manifest/entry count mismatch`);
  }
  for (const entry of archive.entries) {
    const buf = Buffer.from(entry.bytes, "base64");
    if (sha256(buf) !== entry.sha256) throw new Error(`${label}: checksum mismatch for ${entry.name}`);
    validateStoreFile(entry.name, buf);
  }
  return archive;
}

export function archiveFileName(now = new Date()): string {
  return `${ARCHIVE_PREFIX}${now.toISOString().replace(/[:.]/g, "-")}${ARCHIVE_SUFFIX}`;
}

/** Write an archive of `source` into `outDir`, verifying it before it counts. */
export async function writeBackup(source: string, outDir: string, now = new Date()): Promise<{ file: string; entries: ArchiveEntry[] }> {
  const entries = await collectEntries(source);
  const raw = serializeArchive(buildArchive(entries, source, now));
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, archiveFileName(now));
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, raw);
  // Read back from disk: catches truncation and bad writes, not just bad input.
  parseArchive(await readFile(tmp), file);
  await rename(tmp, file);
  return { file, entries };
}

export async function listBackups(dir: string): Promise<string[]> {
  const files = await readdir(dir).catch(() => [] as string[]);
  return files.filter((f) => f.startsWith(ARCHIVE_PREFIX) && f.endsWith(ARCHIVE_SUFFIX)).sort().reverse();
}

/** Delete all but the `keep` most recent archives. Returns what was removed. */
export async function pruneBackups(dir: string, keep: number): Promise<string[]> {
  if (!Number.isFinite(keep) || keep < 1) throw new Error("keep must be a positive number");
  const doomed = (await listBackups(dir)).slice(keep);
  for (const f of doomed) await rm(path.join(dir, f), { force: true });
  return doomed;
}

export interface RestorePlanItem {
  name: string;
  action: "create" | "overwrite";
  size: number;
}

export interface RestorePlan {
  items: RestorePlanItem[];
  /** Files present in the target that this archive does not contain. */
  untouched: string[];
}

export async function planRestore(archive: Archive, target: string): Promise<RestorePlan> {
  const existing = new Set(
    (await readdir(target, { withFileTypes: true }).catch(() => []))
      .filter((e) => e.isFile())
      .map((e) => e.name),
  );
  return {
    items: archive.entries.map((e) => ({
      name: e.name,
      action: existing.has(e.name) ? "overwrite" : "create",
      size: e.size,
    })),
    untouched: [...existing].filter((n) => !archive.entries.some((e) => e.name === n)),
  };
}

/** Write archive contents into `target`, each file atomically. */
export async function applyRestore(archive: Archive, target: string): Promise<string[]> {
  await mkdir(target, { recursive: true });
  const written: string[] = [];
  for (const entry of archive.entries) {
    const dest = path.join(target, entry.name);
    const tmp = `${dest}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, Buffer.from(entry.bytes, "base64"));
    await rename(tmp, dest);
    written.push(entry.name);
  }
  return written;
}
