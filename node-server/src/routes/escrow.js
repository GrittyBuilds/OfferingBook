import { Router } from 'express';
import db from '../db.js';
import { dollarsToCents, str, num, bool } from '../util.js';
import { escrowSummary } from '../summaries.js';

const router = Router();

const TXN_TYPES = new Set(['deposit', 'release', 'refund', 'fee']);

function bodyToRow(b) {
  const type = str(b.txn_type) || 'deposit';
  return {
    investor_id: num(b.investor_id),
    txn_type: TXN_TYPES.has(type) ? type : 'deposit',
    amount_cents: Math.abs(dollarsToCents(b.amount) || 0),
    txn_date: str(b.txn_date),
    method: str(b.method),
    reference: str(b.reference),
    cleared: bool(b.cleared),
    notes: str(b.notes),
  };
}

// Full escrow ledger for an offering plus the computed rollup.
router.get('/offerings/:offeringId/escrow', (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, i.name AS investor_name
         FROM escrow_transactions e
         LEFT JOIN investors i ON i.id = e.investor_id
        WHERE e.offering_id = ?
        ORDER BY COALESCE(e.txn_date, e.created_at) DESC, e.id DESC`
    )
    .all(req.params.offeringId);
  res.json({ transactions: rows, summary: escrowSummary(Number(req.params.offeringId)) });
});

router.post('/offerings/:offeringId/escrow', (req, res) => {
  const offering = db.prepare('SELECT id FROM offerings WHERE id = ?').get(req.params.offeringId);
  if (!offering) return res.status(404).json({ error: 'Offering not found' });

  const row = bodyToRow(req.body);
  if (!row.amount_cents) return res.status(400).json({ error: 'Amount must be greater than zero' });

  const data = { ...row, offering_id: Number(req.params.offeringId) };
  const cols = Object.keys(data);
  const info = db
    .prepare(
      `INSERT INTO escrow_transactions (${cols.join(',')})
       VALUES (${cols.map((c) => '@' + c).join(',')})`
    )
    .run(data);
  res.status(201).json(
    db.prepare('SELECT * FROM escrow_transactions WHERE id = ?').get(info.lastInsertRowid)
  );
});

router.put('/escrow/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM escrow_transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  const row = bodyToRow(req.body);
  if (!row.amount_cents) return res.status(400).json({ error: 'Amount must be greater than zero' });

  const cols = Object.keys(row);
  db.prepare(
    `UPDATE escrow_transactions SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`
  ).run({ ...row, id: req.params.id });
  res.json(db.prepare('SELECT * FROM escrow_transactions WHERE id = ?').get(req.params.id));
});

router.delete('/escrow/:id', (req, res) => {
  const info = db.prepare('DELETE FROM escrow_transactions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true });
});

export default router;
