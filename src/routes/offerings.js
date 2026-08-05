import { Router } from 'express';
import db, { DEFAULT_CHECKLIST } from '../db.js';
import { dollarsToCents, str } from '../util.js';
import { offeringSummary } from '../summaries.js';

const router = Router();

function bodyToRow(b) {
  return {
    name: str(b.name),
    issuer_name: str(b.issuer_name),
    exemption: str(b.exemption),
    security_type: str(b.security_type),
    status: str(b.status) || 'Drafting',
    target_min_cents: dollarsToCents(b.target_min),
    target_max_cents: dollarsToCents(b.target_max),
    price_per_unit_cents: dollarsToCents(b.price_per_unit),
    min_investment_cents: dollarsToCents(b.min_investment),
    launch_date: str(b.launch_date),
    first_close_date: str(b.first_close_date),
    final_close_date: str(b.final_close_date),
    form_d_filed_date: str(b.form_d_filed_date),
    escrow_agent: str(b.escrow_agent),
    escrow_bank: str(b.escrow_bank),
    escrow_account_number: str(b.escrow_account_number),
    notes: str(b.notes),
  };
}

// List all offerings with summary figures for the dashboard/list view.
router.get('/', (req, res) => {
  const offerings = db.prepare('SELECT * FROM offerings ORDER BY created_at DESC').all();
  res.json(offerings.map((o) => ({ ...o, summary: offeringSummary(o) })));
});

router.get('/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM offerings WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Offering not found' });
  res.json({ ...o, summary: offeringSummary(o) });
});

router.post('/', (req, res) => {
  const row = bodyToRow(req.body);
  if (!row.name) return res.status(400).json({ error: 'Offering name is required' });

  const cols = Object.keys(row);
  const info = db
    .prepare(
      `INSERT INTO offerings (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`
    )
    .run(row);

  const offeringId = info.lastInsertRowid;

  // Seed the default process checklist.
  const insertTask = db.prepare(
    'INSERT INTO tasks (offering_id, label, sort_order) VALUES (?, ?, ?)'
  );
  const seed = db.transaction(() => {
    DEFAULT_CHECKLIST.forEach((label, i) => insertTask.run(offeringId, label, i));
  });
  seed();

  const o = db.prepare('SELECT * FROM offerings WHERE id = ?').get(offeringId);
  res.status(201).json({ ...o, summary: offeringSummary(o) });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM offerings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Offering not found' });

  const row = bodyToRow(req.body);
  if (!row.name) return res.status(400).json({ error: 'Offering name is required' });

  const cols = Object.keys(row);
  db.prepare(
    `UPDATE offerings SET ${cols.map((c) => `${c} = @${c}`).join(', ')},
       updated_at = datetime('now') WHERE id = @id`
  ).run({ ...row, id: req.params.id });

  const o = db.prepare('SELECT * FROM offerings WHERE id = ?').get(req.params.id);
  res.json({ ...o, summary: offeringSummary(o) });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM offerings WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Offering not found' });
  res.json({ ok: true });
});

export default router;
