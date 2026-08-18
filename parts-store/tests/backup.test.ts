import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  applyRestore, archiveFileName, buildArchive, collectEntries, listBackups,
  parseArchive, planRestore, pruneBackups, serializeArchive, validateStoreFile, writeBackup,
} from "../src/lib/backup";

function tmp(label: string): string {
  return mkdtempSync(path.join(tmpdir(), `jme-backup-${label}-`));
}

/** A data dir that looks like the real one: a JSON store and a JSONL log. */
async function seedDataDir(): Promise<string> {
  const dir = tmp("data");
  await writeFile(path.join(dir, "rfqs.json"), JSON.stringify({ rfqs: [{ ref: "RFQ-1", contact: { company: "Acme" } }] }));
  await writeFile(path.join(dir, "audit.jsonl"), '{"kind":"a"}\n{"kind":"b"}\n');
  return dir;
}

/* ---- validation: a corrupt store must never be archived ---- */

test("validateStoreFile accepts good JSON and JSONL, including blank lines", () => {
  validateStoreFile("rfqs.json", Buffer.from('{"ok":true}'));
  validateStoreFile("audit.jsonl", Buffer.from('{"a":1}\n\n{"b":2}\n'));
  validateStoreFile("notes.txt", Buffer.from("anything at all"));
});

test("validateStoreFile names the offending file and line", () => {
  assert.throws(() => validateStoreFile("rfqs.json", Buffer.from('{"broken":')), /rfqs\.json is not valid JSON/);
  assert.throws(() => validateStoreFile("audit.jsonl", Buffer.from('{"a":1}\nnope\n')), /audit\.jsonl line 2/);
});

test("collectEntries refuses a corrupt store rather than archiving it", async () => {
  const dir = tmp("corrupt");
  await writeFile(path.join(dir, "rfqs.json"), '{"rfqs":[');
  await assert.rejects(collectEntries(dir), /rfqs\.json is not valid JSON/);
});

test("collectEntries refuses an empty or missing data directory", async () => {
  await assert.rejects(collectEntries(tmp("empty")), /refusing to write an empty backup/);
  await assert.rejects(collectEntries(path.join(tmp("gone"), "nope")), /data directory not found/);
});

/* ---- archive integrity ---- */

test("archive round-trips every byte", async () => {
  const dir = await seedDataDir();
  const entries = await collectEntries(dir);
  const archive = parseArchive(serializeArchive(buildArchive(entries, dir)));
  assert.equal(archive.entries.length, 2);
  const rfqs = archive.entries.find((e) => e.name === "rfqs.json")!;
  assert.deepEqual(JSON.parse(Buffer.from(rfqs.bytes, "base64").toString()), {
    rfqs: [{ ref: "RFQ-1", contact: { company: "Acme" } }],
  });
});

test("parseArchive rejects a tampered payload", async () => {
  const dir = await seedDataDir();
  const archive = buildArchive(await collectEntries(dir), dir);
  archive.entries[0]!.bytes = Buffer.from("tampered").toString("base64");
  assert.throws(() => parseArchive(serializeArchive(archive)), /checksum mismatch/);
});

test("parseArchive rejects a truncated or non-gzip file", () => {
  assert.throws(() => parseArchive(Buffer.from("not gzip at all")), /unreadable/);
});

test("parseArchive rejects an unknown format and a miscounted manifest", async () => {
  const dir = await seedDataDir();
  const good = buildArchive(await collectEntries(dir), dir);

  const wrongFormat = { ...good, manifest: { ...good.manifest, format: 99 } };
  assert.throws(() => parseArchive(gzipSync(Buffer.from(JSON.stringify(wrongFormat)))), /unrecognised archive format/);

  const miscounted = { ...good, manifest: { ...good.manifest, files: good.manifest.files.slice(1) } };
  assert.throws(() => parseArchive(gzipSync(Buffer.from(JSON.stringify(miscounted)))), /manifest\/entry count mismatch/);
});

/* ---- writing, listing, pruning ---- */

test("writeBackup produces a verifiable archive and leaves no temp files", async () => {
  const dir = await seedDataDir();
  const out = tmp("out");
  const { file, entries } = await writeBackup(dir, out);
  assert.equal(entries.length, 2);
  parseArchive(await readFile(file), file); // throws if not verifiable
  assert.deepEqual((await readdir(out)).filter((f) => f.endsWith(".tmp")), []);
});

test("archive names sort chronologically, so 'newest first' is just a reverse sort", () => {
  const older = archiveFileName(new Date("2026-01-02T03:04:05.000Z"));
  const newer = archiveFileName(new Date("2026-11-02T03:04:05.000Z"));
  assert.ok(older < newer);
  assert.match(older, /^jme-data-.*\.json\.gz$/);
});

test("pruneBackups keeps the newest N and rejects a nonsense keep", async () => {
  const dir = await seedDataDir();
  const out = tmp("prune");
  for (const iso of ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]) {
    await writeBackup(dir, out, new Date(`${iso}T00:00:00.000Z`));
  }
  const pruned = await pruneBackups(out, 2);
  assert.equal(pruned.length, 2);
  const left = await listBackups(out);
  assert.equal(left.length, 2);
  assert.ok(left[0]!.includes("2026-04-01"), "newest is kept");
  assert.ok(left.every((f) => !f.includes("2026-01-01")), "oldest is gone");
  await assert.rejects(pruneBackups(out, 0), /keep must be a positive number/);
});

/* ---- restore ---- */

test("planRestore distinguishes create, overwrite, and leave-alone", async () => {
  const source = await seedDataDir();
  const archive = buildArchive(await collectEntries(source), source);

  const target = tmp("target");
  await writeFile(path.join(target, "rfqs.json"), "{}");        // will be overwritten
  await writeFile(path.join(target, "quotecenter.json"), "{}"); // not in the archive

  const plan = await planRestore(archive, target);
  assert.equal(plan.items.find((i) => i.name === "rfqs.json")!.action, "overwrite");
  assert.equal(plan.items.find((i) => i.name === "audit.jsonl")!.action, "create");
  assert.deepEqual(plan.untouched, ["quotecenter.json"]);
});

test("applyRestore writes byte-identical files and leaves unrelated ones alone", async () => {
  const source = await seedDataDir();
  const archive = buildArchive(await collectEntries(source), source);
  const target = tmp("restore");
  await writeFile(path.join(target, "quotecenter.json"), '{"keep":"me"}');

  await applyRestore(archive, target);

  for (const name of ["rfqs.json", "audit.jsonl"]) {
    assert.deepEqual(await readFile(path.join(target, name)), await readFile(path.join(source, name)), `${name} identical`);
  }
  assert.equal(JSON.parse(await readFile(path.join(target, "quotecenter.json"), "utf8")).keep, "me");
  assert.deepEqual((await readdir(target)).filter((f) => f.endsWith(".tmp")), []);
});

test("full disaster drill: backup, lose everything, restore", async () => {
  const live = await seedDataDir();
  const out = tmp("drill");
  const { file } = await writeBackup(live, out);

  // Total loss: the volume comes back empty.
  const rebuilt = tmp("rebuilt");
  await mkdir(rebuilt, { recursive: true });

  const archive = parseArchive(await readFile(file), file);
  await applyRestore(archive, rebuilt);

  const restored = JSON.parse(await readFile(path.join(rebuilt, "rfqs.json"), "utf8"));
  assert.equal(restored.rfqs[0].ref, "RFQ-1");
  assert.equal(restored.rfqs[0].contact.company, "Acme");
  assert.equal((await readFile(path.join(rebuilt, "audit.jsonl"), "utf8")).trim().split("\n").length, 2);
});

/* ---- restoring ONTO corrupt data: the case the tool exists for ---- */

test("the pre-restore snapshot archives corrupt data instead of refusing it", async () => {
  // Restore takes a copy of what it is about to overwrite so that restoring
  // the wrong archive is itself recoverable. The usual reason to be restoring
  // is that the live data is broken, so that copy cannot parse-check its input
  // — and a broken store is the one you most want a copy of before it goes.
  const dir = await seedDataDir();
  await writeFile(path.join(dir, "qc.json"), '{"quotes":[{"id":"trunc');

  await assert.rejects(() => collectEntries(dir), /qc\.json is not valid JSON/);

  const entries = await collectEntries(dir, { validate: false });
  const qc = entries.find((e) => e.name === "qc.json")!;
  assert.equal(Buffer.from(qc.bytes, "base64").toString("utf8"), '{"quotes":[{"id":"trunc');
});

test("writeBackup can snapshot a corrupt directory end to end", async () => {
  // writeBackup re-reads its own output to catch truncation. That read-back
  // must not re-apply content validation to a snapshot taken deliberately of
  // invalid data, or the whole call fails after the bytes are already written.
  const dir = await seedDataDir();
  await writeFile(path.join(dir, "qc.json"), '{"quotes":[{"id":"trunc');
  const out = tmp("snap");

  await assert.rejects(() => writeBackup(dir, out), /qc\.json is not valid JSON/);

  const { file } = await writeBackup(dir, out, new Date(), { validate: false });
  const archive = parseArchive(await readFile(file), file, { validate: false });
  const qc = archive.entries.find((e) => e.name === "qc.json")!;
  assert.equal(Buffer.from(qc.bytes, "base64").toString("utf8"), '{"quotes":[{"id":"trunc');
});

test("checksums are still enforced on a snapshot of corrupt data", async () => {
  // validate:false relaxes the parse check, never the integrity check.
  const dir = await seedDataDir();
  await writeFile(path.join(dir, "qc.json"), '{"quotes":[{"id":"trunc');
  const out = tmp("snap2");
  const { file } = await writeBackup(dir, out, new Date(), { validate: false });

  const archive = parseArchive(await readFile(file), file, { validate: false });
  archive.entries[0]!.bytes = Buffer.from("tampered").toString("base64");
  const tampered = gzipSync(Buffer.from(JSON.stringify(archive)));
  assert.throws(() => parseArchive(tampered, "t", { validate: false }), /checksum mismatch/);
});

test("disaster drill with corrupt live data: the runbook path end to end", async () => {
  // The drill above loses the volume entirely, which leaves nothing to
  // snapshot. This is the likelier failure and the one that was broken: the
  // files are still there and one of them is truncated.
  const live = await seedDataDir();
  await writeFile(path.join(live, "qc.json"), JSON.stringify({ quotes: [{ id: "q1" }] }));
  const out = tmp("drill-corrupt");
  const { file } = await writeBackup(live, out);

  await writeFile(path.join(live, "qc.json"), '{"quotes":[{"id":"trunc');
  await writeFile(path.join(live, "rfqs.json"), "");

  // The safety snapshot restore would take of the damaged directory.
  const safety = await writeBackup(live, path.join(out, "pre-restore"), new Date(), { validate: false });
  const kept = parseArchive(await readFile(safety.file), safety.file, { validate: false });
  assert.equal(
    Buffer.from(kept.entries.find((e) => e.name === "qc.json")!.bytes, "base64").toString("utf8"),
    '{"quotes":[{"id":"trunc',
    "the damaged copy has to survive, in case it is the one worth salvaging",
  );

  await applyRestore(parseArchive(await readFile(file), file), live);
  assert.deepEqual(JSON.parse(await readFile(path.join(live, "qc.json"), "utf8")), { quotes: [{ id: "q1" }] });
  assert.equal(JSON.parse(await readFile(path.join(live, "rfqs.json"), "utf8")).rfqs[0].ref, "RFQ-1");
});

test("a scheduled backup still refuses to archive a corrupt store", async () => {
  // The relaxation is opt-in and must stay that way: archiving a broken store
  // on a schedule buries the last good copy under 14 useless ones.
  const dir = await seedDataDir();
  await writeFile(path.join(dir, "qc.json"), '{"quotes":[{"id":"trunc');
  await assert.rejects(() => writeBackup(dir, tmp("sched")), /qc\.json is not valid JSON/);
});
