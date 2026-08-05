import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The database lives in ./data/offeringbook.db at the project root.
// Backing up the whole app is as simple as copying that one file.
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.OFFERINGBOOK_DB || join(dataDir, 'offeringbook.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS offerings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  issuer_name           TEXT,
  exemption             TEXT,
  security_type         TEXT,
  status                TEXT NOT NULL DEFAULT 'Drafting',
  target_min_cents      INTEGER,
  target_max_cents      INTEGER,
  price_per_unit_cents  INTEGER,
  min_investment_cents  INTEGER,
  launch_date           TEXT,
  first_close_date      TEXT,
  final_close_date      TEXT,
  form_d_filed_date     TEXT,
  escrow_agent          TEXT,
  escrow_bank           TEXT,
  escrow_account_number TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investors (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT NOT NULL,
  entity_type            TEXT NOT NULL DEFAULT 'Individual',
  contact_name           TEXT,
  email                  TEXT,
  phone                  TEXT,
  address                TEXT,
  accredited_status      TEXT NOT NULL DEFAULT 'Unknown',
  accredited_verified_date TEXT,
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id           INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  investor_id           INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  amount_committed_cents INTEGER,
  units                 REAL,
  status                TEXT NOT NULL DEFAULT 'Prospect',
  sub_sent_date         TEXT,
  sub_signed_date       TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id  INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  investor_id  INTEGER REFERENCES investors(id) ON DELETE SET NULL,
  txn_type     TEXT NOT NULL DEFAULT 'deposit',   -- deposit | release | refund | fee
  amount_cents INTEGER NOT NULL,                   -- always stored positive
  txn_date     TEXT,
  method       TEXT,                               -- Wire | Check | ACH | Other
  reference    TEXT,
  cleared      INTEGER NOT NULL DEFAULT 0,         -- 0 pending, 1 cleared
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  due_date    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliations (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id             INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  statement_date          TEXT,
  statement_balance_cents INTEGER NOT NULL,
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sub_offering ON subscriptions(offering_id);
CREATE INDEX IF NOT EXISTS idx_sub_investor ON subscriptions(investor_id);
CREATE INDEX IF NOT EXISTS idx_escrow_offering ON escrow_transactions(offering_id);
CREATE INDEX IF NOT EXISTS idx_escrow_investor ON escrow_transactions(investor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_offering ON tasks(offering_id);
CREATE INDEX IF NOT EXISTS idx_recon_offering ON reconciliations(offering_id);
`);

// Default process checklist seeded onto every new offering.
export const DEFAULT_CHECKLIST = [
  'Engagement letter signed',
  'Draft Private Placement Memorandum',
  'Draft subscription agreement',
  'Prepare accredited-investor questionnaire',
  'Set up escrow account with escrow agent',
  'Blue sky / state notice filings',
  'File Form D with the SEC',
  'Distribute offering documents to investors',
  'Collect signed subscription agreements',
  'Verify accredited-investor status',
  'Confirm escrow minimum (min-raise) met',
  'Hold closing',
  'Release escrow funds to issuer',
  'Post-closing filings / amendments',
];

export default db;
