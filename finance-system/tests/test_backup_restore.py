"""Backup validation, restore preview, and safe restore."""

import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from finance_system import backup
from finance_system.db import init_db
from tests.helpers import import_fixture


class TestBackupRestore(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.db = Path(self.tmp.name) / "finance.db"
        self.conn = init_db(str(self.db))
        import_fixture(self.conn, post=True)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_backup_validates(self):
        dest = backup.create_backup(self.conn, Path(self.tmp.name) / "b1.db")
        rep = backup.validate_backup(dest)
        self.assertTrue(rep.ok, rep.problems)
        self.assertGreater(rep.counts["transactions"], 0)
        self.assertGreater(rep.counts["calculation_snapshots"], 0)
        self.assertIn("VALID", rep.summary())

    def test_missing_and_corrupt_backups_are_rejected(self):
        missing = backup.validate_backup(Path(self.tmp.name) / "nope.db")
        self.assertFalse(missing.ok)
        junk = Path(self.tmp.name) / "junk.db"
        junk.write_bytes(b"this is not a database" * 100)
        rep = backup.validate_backup(junk)
        self.assertFalse(rep.ok)
        self.assertTrue(rep.problems)

    def test_empty_file_rejected(self):
        empty = Path(self.tmp.name) / "empty.db"
        empty.touch()
        self.assertFalse(backup.validate_backup(empty).ok)

    def test_preview_does_not_touch_active_database(self):
        dest = backup.create_backup(self.conn, Path(self.tmp.name) / "b2.db")
        before = self.conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        prev = backup.preview_restore(dest, self.db)
        self.assertTrue(prev["safe_to_restore"])
        self.assertEqual(prev["record_deltas_if_restored"]["transactions"]["change"], 0)
        after = self.conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        self.assertEqual(before, after)

    def test_restore_requires_confirmation_and_valid_backup(self):
        dest = backup.create_backup(self.conn, Path(self.tmp.name) / "b3.db")
        with self.assertRaises(ValueError):
            backup.restore(dest, self.db)                      # no confirm
        junk = Path(self.tmp.name) / "bad.db"
        junk.write_bytes(b"nope")
        with self.assertRaises(ValueError):
            backup.restore(junk, self.db, confirm=True)        # invalid backup

    def test_restore_takes_safety_backup_first(self):
        dest = backup.create_backup(self.conn, Path(self.tmp.name) / "b4.db")
        # change the active DB after the backup so the restore is observable
        self.conn.execute("DELETE FROM exceptions")
        self.conn.commit()
        removed = self.conn.execute("SELECT COUNT(*) FROM exceptions").fetchone()[0]
        self.assertEqual(removed, 0)
        self.conn.close()

        result = backup.restore(dest, self.db, confirm=True)
        self.assertTrue(result["restored_ok"], result["problems"])
        self.assertIsNotNone(result["safety_backup"])
        self.assertTrue(Path(result["safety_backup"]).is_file())
        # the restored database has the exceptions back
        conn = sqlite3.connect(str(self.db))
        try:
            self.assertGreater(conn.execute("SELECT COUNT(*) FROM exceptions").fetchone()[0], 0)
        finally:
            conn.close()
        self.conn = init_db(str(self.db))   # for tearDown


if __name__ == "__main__":
    unittest.main()
