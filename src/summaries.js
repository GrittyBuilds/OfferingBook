import db from './db.js';

// Signed contribution of each transaction type to the escrow balance.
// Deposits add funds; releases, refunds and fees remove them.
const SIGN = { deposit: 1, release: -1, refund: -1, fee: -1 };

/**
 * Escrow rollup for one offering.
 * "book" figures include all transactions; "cleared" figures include only
 * transactions marked cleared (i.e. actually settled at the bank).
 */
export function escrowSummary(offeringId) {
  const rows = db
    .prepare(
      `SELECT txn_type,
              SUM(amount_cents) AS total,
              SUM(CASE WHEN cleared = 1 THEN amount_cents ELSE 0 END) AS cleared_total
         FROM escrow_transactions
        WHERE offering_id = ?
        GROUP BY txn_type`
    )
    .all(offeringId);

  const byType = { deposit: 0, release: 0, refund: 0, fee: 0 };
  const clearedByType = { deposit: 0, release: 0, refund: 0, fee: 0 };
  for (const r of rows) {
    if (r.txn_type in byType) {
      byType[r.txn_type] = r.total || 0;
      clearedByType[r.txn_type] = r.cleared_total || 0;
    }
  }

  const bookBalance =
    (byType.deposit * SIGN.deposit) +
    (byType.release * SIGN.release) +
    (byType.refund * SIGN.refund) +
    (byType.fee * SIGN.fee);

  const clearedBalance =
    (clearedByType.deposit * SIGN.deposit) +
    (clearedByType.release * SIGN.release) +
    (clearedByType.refund * SIGN.refund) +
    (clearedByType.fee * SIGN.fee);

  return {
    deposits: byType.deposit,
    releases: byType.release,
    refunds: byType.refund,
    fees: byType.fee,
    clearedDeposits: clearedByType.deposit,
    bookBalance,
    clearedBalance,
    pendingBalance: bookBalance - clearedBalance,
  };
}

/** Subscription totals for one offering. */
export function subscriptionSummary(offeringId) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(amount_committed_cents), 0) AS committed,
         COALESCE(SUM(CASE WHEN status IN ('Sub signed','Funded','Closed')
                           THEN amount_committed_cents ELSE 0 END), 0) AS signed_committed
       FROM subscriptions
       WHERE offering_id = ?`
    )
    .get(offeringId);
  return {
    investorCount: row.count,
    committed: row.committed,
    signedCommitted: row.signed_committed,
  };
}

/** Days until (positive) or since (negative) a YYYY-MM-DD date, or null. */
export function daysUntil(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - t0) / 86400000);
}

/** Combined summary used by the offering detail header and the dashboard. */
export function offeringSummary(offering) {
  const escrow = escrowSummary(offering.id);
  const subs = subscriptionSummary(offering.id);

  const targetMin = offering.target_min_cents || 0;
  const minRaiseMet = targetMin > 0 && escrow.clearedDeposits >= targetMin;
  const minRaisePct = targetMin > 0
    ? Math.min(100, Math.round((escrow.clearedDeposits / targetMin) * 100))
    : null;

  const tasks = db
    .prepare(`SELECT COUNT(*) AS total, SUM(done) AS done FROM tasks WHERE offering_id = ?`)
    .get(offering.id);

  return {
    escrow,
    subscriptions: subs,
    minRaiseMet,
    minRaisePct,
    daysToFinalClose: daysUntil(offering.final_close_date),
    tasksTotal: tasks.total || 0,
    tasksDone: tasks.done || 0,
  };
}
