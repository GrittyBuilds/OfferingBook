import { Router } from 'express';
import db from '../db.js';
import { str } from '../util.js';

const router = Router();

function bodyToRow(b) {
  return {
    name: str(b.name),
    entity_type: str(b.entity_type) || 'Individual',
    contact_name: str(b.contact_name),
    email: str(b.email),
    phone: str(b.phone),
    address: str(b.address),
    accredited_status: str(b.accredited_status) || 'Unknown',
    accredited_verified_date: str(b.accredited_verified_date),
    notes: str(b.notes),
  };
}

// List investors (the reusable contact book). Includes a count of offerings
// each investor participates in.
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT i.*,
              (SELECT COUNT(*) FROM subscriptions s WHERE s.investor_id = i.id) AS offering_count
         FROM investors i
        ORDER BY i.name COLLATE NOCASE`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investor not found' });

  // Include every subscription this investor holds, across all offerings.
  const subscriptions = db
    .prepare(
      `SELECT s.*, o.name AS offering_name
         FROM subscriptions s
         JOIN offerings o ON o.id = s.offering_id
        WHERE s.investor_id = ?
        ORDER BY o.name COLLATE NOCASE`
    )
    .all(req.params.id);

  res.json({ ...inv, subscriptions });
});

router.post('/', (req, res) => {
  const row = bodyToRow(req.body);
  if (!row.name) return res.status(400).json({ error: 'Investor name is required' });

  const cols = Object.keys(row);
  const info = db
    .prepare(
      `INSERT INTO investors (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`
    )
    .run(row);
  res.status(201).json(db.prepare('SELECT * FROM investors WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Investor not found' });

  const row = bodyToRow(req.body);
  if (!row.name) return res.status(400).json({ error: 'Investor name is required' });

  const cols = Object.keys(row);
  db.prepare(
    `UPDATE investors SET ${cols.map((c) => `${c} = @${c}`).join(', ')},
       updated_at = datetime('now') WHERE id = @id`
  ).run({ ...row, id: req.params.id });
  res.json(db.prepare('SELECT * FROM investors WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  // Protect against silent data loss: block deletion while the investor is
  // referenced by any subscription. Escrow rows keep history (investor set null).
  const subCount = db
    .prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE investor_id = ?')
    .get(req.params.id).n;
  if (subCount > 0) {
    return res.status(409).json({
      error: `This investor is on ${subCount} offering subscription(s). Remove those subscriptions first.`,
    });
  }
  const info = db.prepare('DELETE FROM investors WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Investor not found' });
  res.json({ ok: true });
});

export default router;
