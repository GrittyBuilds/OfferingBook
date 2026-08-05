import { Router } from 'express';
import db from '../db.js';
import { offeringSummary, daysUntil } from '../summaries.js';

const router = Router();

// Firm-wide rollup for the home dashboard.
router.get('/', (req, res) => {
  const offerings = db.prepare('SELECT * FROM offerings').all();

  const byStatus = {};
  let totalInEscrow = 0;      // cleared book balance across all offerings
  let totalCommitted = 0;
  let minRaiseMetCount = 0;
  let activeCount = 0;
  const upcomingClosings = [];

  for (const o of offerings) {
    const s = offeringSummary(o);
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    totalInEscrow += s.escrow.clearedBalance;
    totalCommitted += s.subscriptions.committed;
    if (s.minRaiseMet) minRaiseMetCount += 1;
    if (!['Closed', 'Terminated'].includes(o.status)) activeCount += 1;

    const days = daysUntil(o.final_close_date);
    if (days !== null && days >= 0 && !['Closed', 'Terminated'].includes(o.status)) {
      upcomingClosings.push({
        id: o.id,
        name: o.name,
        final_close_date: o.final_close_date,
        days,
        minRaiseMet: s.minRaiseMet,
      });
    }
  }

  upcomingClosings.sort((a, b) => a.days - b.days);

  const investorCount = db.prepare('SELECT COUNT(*) AS n FROM investors').get().n;

  res.json({
    offeringCount: offerings.length,
    activeCount,
    investorCount,
    totalInEscrow,
    totalCommitted,
    minRaiseMetCount,
    byStatus,
    upcomingClosings: upcomingClosings.slice(0, 8),
  });
});

export default router;
