import { Router } from 'express';
import db from '../db.js';
import { str, bool, num } from '../util.js';

const router = Router();

router.get('/offerings/:offeringId/tasks', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE offering_id = ? ORDER BY sort_order, id')
    .all(req.params.offeringId);
  res.json(rows);
});

router.post('/offerings/:offeringId/tasks', (req, res) => {
  const offering = db.prepare('SELECT id FROM offerings WHERE id = ?').get(req.params.offeringId);
  if (!offering) return res.status(404).json({ error: 'Offering not found' });

  const label = str(req.body.label);
  if (!label) return res.status(400).json({ error: 'Task label is required' });

  const nextOrder =
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM tasks WHERE offering_id = ?')
      .get(req.params.offeringId).n;

  const info = db
    .prepare('INSERT INTO tasks (offering_id, label, due_date, sort_order) VALUES (?, ?, ?, ?)')
    .run(req.params.offeringId, label, str(req.body.due_date), nextOrder);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const row = {
    label: str(req.body.label) ?? existing.label,
    done: req.body.done === undefined ? existing.done : bool(req.body.done),
    due_date: 'due_date' in req.body ? str(req.body.due_date) : existing.due_date,
    sort_order: num(req.body.sort_order) ?? existing.sort_order,
  };
  db.prepare(
    'UPDATE tasks SET label = @label, done = @done, due_date = @due_date, sort_order = @sort_order WHERE id = @id'
  ).run({ ...row, id: req.params.id });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

export default router;
