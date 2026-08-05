import { Router } from 'express';
import db from '../db.js';
import { dollarsToCents, str, num } from '../util.js';

const router = Router();

function bodyToRow(b) {
  return {
    investor_id: num(b.investor_id),
    amount_committed_cents: dollarsToCents(b.amount_committed),
    units: num(b.units),
    status: str(b.status) || 'Prospect',
    sub_sent_date: str(b.sub_sent_date),
    sub_signed_date: str(b.sub_signed_date),
    notes: str(b.notes),
  };
}

// List subscriptions for one offering, joined to investor contact info.
router.get('/offerings/:offeringId/subscriptions', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, i.name AS investor_name, i.entity_type, i.email, i.phone,
              i.accredited_status
         FROM subscriptions s
         JOIN investors i ON i.id = s.investor_id
        WHERE s.offering_id = ?
        ORDER BY i.name COLLATE NOCASE`
    )
    .all(req.params.offeringId);
  res.json(rows);
});

router.post('/offerings/:offeringId/subscriptions', (req, res) => {
  const offering = db.prepare('SELECT id FROM offerings WHERE id = ?').get(req.params.offeringId);
  if (!offering) return res.status(404).json({ error: 'Offering not found' });

  const row = bodyToRow(req.body);
  if (!row.investor_id) return res.status(400).json({ error: 'Investor is required' });
  const investor = db.prepare('SELECT id FROM investors WHERE id = ?').get(row.investor_id);
  if (!investor) return res.status(400).json({ error: 'Investor not found' });

  const data = { ...row, offering_id: Number(req.params.offeringId) };
  const cols = Object.keys(data);
  const info = db
    .prepare(
      `INSERT INTO subscriptions (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`
    )
    .run(data);
  res.status(201).json(
    db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(info.lastInsertRowid)
  );
});

router.put('/subscriptions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });

  const row = bodyToRow(req.body);
  if (!row.investor_id) return res.status(400).json({ error: 'Investor is required' });

  const cols = Object.keys(row);
  db.prepare(
    `UPDATE subscriptions SET ${cols.map((c) => `${c} = @${c}`).join(', ')},
       updated_at = datetime('now') WHERE id = @id`
  ).run({ ...row, id: req.params.id });
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id));
});

router.delete('/subscriptions/:id', (req, res) => {
  const info = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Subscription not found' });
  res.json({ ok: true });
});

export default router;
