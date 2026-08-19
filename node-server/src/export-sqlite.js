/**
 * A one-time export from the old SQLite database to a Muniment data file.
 *
 * The server used to keep its own records in SQLite, in a schema that had
 * fallen behind the app's. That implementation is gone; this reads what it
 * left behind and writes a document the app can open — so a firm that used the
 * server version loses nothing, and can carry on in the single file with
 * everything that has been built since.
 *
 *   cd node-server
 *   npm install better-sqlite3        # only needed for this, and only once
 *   node src/export-sqlite.js         # writes muniment-from-sqlite.json
 *
 * Then open Muniment.html and use "Open file…" (or "Import…") to adopt it.
 *
 * Nothing is written back to the database; it is read and left alone.
 */
import { writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

// Databases written under the earlier names, newest first.
const NAMES = ['muniment.db', 'capitalvault.db', 'offeringbook.db']
function findDb () {
  const configured = process.env.MUNIMENT_DB || process.env.CAPITALVAULT_DB
  if (configured) return configured
  for (const n of NAMES) {
    const p = join(dataDir, n)
    if (existsSync(p)) return p
  }
  return null
}

let Database
try {
  Database = require('better-sqlite3')
} catch {
  console.error('This export needs better-sqlite3, which is no longer a dependency of the server.')
  console.error('Install it once, run the export, and remove it again:')
  console.error('\n  npm install better-sqlite3\n  node src/export-sqlite.js\n')
  process.exit(2)
}

const path = findDb()
if (!path) {
  console.error(`No database found in ${dataDir}. Nothing to export.`)
  console.error('If it lives elsewhere, point MUNIMENT_DB at it.')
  process.exit(1)
}

const db = new Database(path, { readonly: true })
const all = table => {
  try { return db.prepare(`SELECT * FROM ${table}`).all() } catch { return [] }
}
const iso = v => (v ? String(v).replace(' ', 'T').replace(/Z?$/, 'Z') : null)

const offerings = all('offerings')
const investors = all('investors')
const subscriptions = all('subscriptions')
const escrow = all('escrow_transactions')
const tasks = all('tasks')
const reconciliations = all('reconciliations')

// The app's own shape. The collections the SQLite schema never had come
// through empty; normalize() fills in everything else on load, and the
// migrations bring the document to the current version.
const doc = {
  meta: { version: 2, app: 'Muniment', exported_from: path, exported_at: new Date().toISOString() },
  seq: {},
  offerings: offerings.map(o => ({
    ...o,
    created_at: iso(o.created_at), updated_at: iso(o.updated_at),
    // Fields the single-file app carries that the schema never had. Left
    // absent rather than invented: normalize() and the migrations decide.
    classes: [], tranches: [],
  })),
  investors: investors.map(i => ({ ...i, created_at: iso(i.created_at), updated_at: iso(i.updated_at) })),
  subscriptions: subscriptions.map(s => ({ ...s, created_at: iso(s.created_at), updated_at: iso(s.updated_at) })),
  escrow: escrow.map(e => ({ ...e, created_at: iso(e.created_at) })),
  tasks, reconciliations,
  closings: [], certificates: [], parties: [], activity: [],
  distributions: [], transfers: [], capital_calls: [], state_filings: [],
  settings: {}, dismissed: {},
}
// Counters ahead of every id in the file, so nothing collides after import.
for (const [k, rows] of Object.entries(doc)) {
  if (!Array.isArray(rows)) continue
  doc.seq[k] = rows.reduce((m, r) => Math.max(m, Number(r && r.id) || 0), 0)
}

const out = join(__dirname, '..', 'muniment-from-sqlite.json')
writeFileSync(out, JSON.stringify(doc, null, 2))

const counts = Object.entries(doc)
  .filter(([, v]) => Array.isArray(v) && v.length)
  .map(([k, v]) => `${v.length} ${k}`)
console.log(`Read ${path}`)
console.log(`Wrote ${out}`)
console.log(counts.length ? `  ${counts.join(', ')}` : '  the database was empty')
console.log('\nOpen Muniment.html and use “Open file…” (or “Import…”) to adopt it.')
console.log('The database has not been changed; keep it until you are satisfied the import is right.')
