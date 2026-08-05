import { Router } from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import db, { DB_PATH } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// Download a consistent snapshot of the SQLite database. Using the SQLite
// backup API (rather than copying the file) guarantees WAL data is included.
router.get('/', async (req, res) => {
  const backupsDir = join(__dirname, '..', '..', 'backups');
  mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(backupsDir, `capitalvault-backup-${stamp}.db`);

  try {
    await db.backup(outPath);
    res.download(outPath, `capitalvault-backup-${stamp}.db`, (err) => {
      // Clean up the temp snapshot once the download finishes.
      if (existsSync(outPath)) {
        try { unlinkSync(outPath); } catch { /* ignore */ }
      }
      if (err && !res.headersSent) res.status(500).json({ error: 'Backup failed' });
    });
  } catch (e) {
    res.status(500).json({ error: 'Backup failed: ' + e.message });
  }
});

// Report where the live database file lives, for manual backups.
router.get('/path', (req, res) => {
  res.json({ path: DB_PATH });
});

export default router;
