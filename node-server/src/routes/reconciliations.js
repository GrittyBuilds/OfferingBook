import { Router } from 'express';
import db from '../db.js';
import { dollarsToCents, str } from '../util.js';
import { escrowSummary } from '../summaries.js';

const router = Router();

// Reconciliation view: the app's cleared book balance vs. the bank statement.
router.get('/offerings/:offeringId/reconciliations', (req, res) => {
  const offeringId = Number(req.params.offeringId);
  const rows = db
    .prepare('SELECT * FROM reconciliations WHERE offering_id = ? ORDER BY COALESCE(statement_date, created_at) DESC, id DESC')
    .all(offeringId);
  const summary = escrowSummary(offeringId);

  const withDiff = rows.map((r) => ({
    ...r,
    difference_cents: r.statement_balance_cents - summary.clearedBalance,
  }));
  res.json({ reconciliations: withDiff, summary });
});

router.post('/offerings/:offeringId/reconciliations', (req, res) => {
  const offering = db.prepare('SELECT id FROM offerings WHERE id = ?').get(req.params.offeringId);
  if (!offering) return res.status(404).json({ error: 'Offering not found' });

  const balance = dollarsToCents(req.body.statement_balance);
  if (balance === null) return res.status(400).json({ error: 'Statement balance is required' });

  const info = db
    .prepare(
      'INSERT INTO reconciliations (offering_id, statement_date, statement_balance_cents, notes) VALUES (?, ?, ?, ?)'
    )
    .run(req.params.offeringId, str(req.body.statement_date), balance, str(req.body.notes));
  res.status(201).json(
    db.prepare('SELECT * FROM reconciliations WHERE id = ?').get(info.lastInsertRowid)
  );
});

router.delete('/reconciliations/:id', (req, res) => {
  const info = db.prepare('DELETE FROM reconciliations WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Reconciliation not found' });
  res.json({ ok: true });
});

export default router;
