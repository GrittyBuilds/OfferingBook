#!/usr/bin/env node
/**
 * Muniment documents test.
 *
 * What the app can put on paper or hand to a spreadsheet: the certificate,
 * the holder's statement, and the CSV exports.
 *
 * The print reports live in #print-root, which is hidden on screen and shown
 * only under print media — so these assertions read that subtree directly
 * rather than emulating print, and check that it is cleared afterwards, since
 * a report left behind would print again on the next plain Ctrl+P.
 *
 *   node tools/documents.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
function loadPlaywright () {
  const roots = [execSync('npm root -g', { encoding: 'utf8' }).trim(),
    join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules')]
  for (const root of roots) {
    try { return require(join(root, 'playwright', 'index.js')) } catch { /* keep looking */ }
  }
  console.error('playwright is not installed. Try:  npm i -D playwright')
  process.exit(2)
}
const { chromium } = loadPlaywright()
const APP = 'file://' + (process.env.MUNIMENT_APP || join(dirname(fileURLToPath(import.meta.url)), '..', 'Muniment.html'))

const fails = []
const ok = (c, label) => { console.log((c ? '  ok   ' : '  FAIL ') + label); if (!c) fails.push(label) }
const iso = '2026-01-01T00:00:00.000Z'

const seed = {
  meta: { version: 3, app: 'Muniment' },
  seq: { offerings: 9, investors: 99, subscriptions: 99, escrow: 99, tasks: 99, reconciliations: 9, closings: 9, certificates: 99, parties: 0, activity: 0, distributions: 9, transfers: 9, capital_calls: 0, state_filings: 0 },
  offerings: [{
    id: 1, name: 'Cathedral Yard Fund I', issuer_name: 'Cathedral Yard Holdings LLC',
    status: 'Closed', exemption: 'Reg D 506(b)', security_type: 'LLC Units',
    price_per_unit_cents: 100000, default_return_rate: 8, accrual_convention: 'simple/365',
    bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso,
  }],
  investors: [
    { id: 1, name: 'Rooke Family Trust', entity_type: 'Trust', tax_id: '987654321', email: 'trustee@example.test', state: 'MI', address: '10 Chancery Row, Ann Arbor, MI 48104', accredited_status: 'Verified', accreditation_basis: 'Net worth', accredited_verified_date: '2026-01-05', accredited_evidence_date: '2026-01-05', created_at: iso },
    { id: 2, name: 'Second Holder LLC', entity_type: 'Entity', state: 'OH', accredited_status: 'Verified', accredited_verified_date: '2026-01-05', created_at: iso },
  ],
  subscriptions: [
    { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 6000000, units: 60, status: 'Closed', closing_id: 1, sub_signed_date: '2026-02-01', funded_date: '2026-02-10', created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 4000000, units: 40, status: 'Closed', closing_id: 1, sub_signed_date: '2026-02-02', funded_date: '2026-02-11', created_at: iso },
  ],
  escrow: [
    { id: 1, offering_id: 1, investor_id: 1, subscription_id: 1, txn_type: 'deposit', amount_cents: 6000000, txn_date: '2026-02-10', method: 'Wire', reference: 'FED-8812', cleared: 1, created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, subscription_id: 2, txn_type: 'deposit', amount_cents: 4000000, txn_date: '2026-02-11', method: 'Wire', cleared: 1, created_at: iso },
    { id: 3, offering_id: 1, investor_id: null, txn_type: 'release', amount_cents: 10000000, txn_date: '2026-03-01', cleared: 1, closing_id: 1, created_at: iso },
  ],
  tasks: [], reconciliations: [],
  closings: [{ id: 1, offering_id: 1, label: 'Closing 1', closing_date: '2026-03-01', amount_released_cents: 10000000, fees_cents: 0, created_at: iso }],
  certificates: [
    { id: 1, offering_id: 1, investor_id: 1, subscription_id: 1, closing_id: 1, cert_number: '1', class_name: 'Class A Units', capital_cents: 6000000, pref_return_rate: 8, accrual_convention: 'simple/365', accrual_start: '2026-03-01', issue_date: '2026-03-01', funded_date: '2026-02-10', sort_index: 1, no_capital: 0, created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, subscription_id: 2, closing_id: 1, cert_number: '2', class_name: 'Class A Units', capital_cents: 4000000, pref_return_rate: 8, accrual_convention: 'simple/365', accrual_start: '2026-03-01', issue_date: '2026-03-01', funded_date: '2026-02-11', sort_index: 2, no_capital: 0, created_at: iso },
  ],
  parties: [], activity: [],
  distributions: [{
    id: 1, offering_id: 1, label: 'Q2 distribution', pay_date: '2026-07-01', amount_cents: 500000, basis: 'pref-first',
    allocations: [
      { certificate_id: 1, investor_id: 1, pref_cents: 300000, capital_cents: 0 },
      { certificate_id: 2, investor_id: 2, pref_cents: 200000, capital_cents: 0 },
    ], created_at: iso,
  }],
  transfers: [], capital_calls: [], state_filings: [],
  settings: { firm_name: 'Bellweather & Rooke LLP', firm_contact: '(313) 555-0100', mask_account_numbers: 1 },
  dismissed: {},
}

const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
// window.print blocks a headless run; the report is built either way, which is
// what these assertions are about.
await page.addInitScript(s => {
  localStorage.setItem('muniment:data', JSON.stringify(s))
  window.print = () => { window.__printed = (window.__printed || 0) + 1 }
}, seed)
await page.goto(APP, { waitUntil: 'load' })
await page.waitForTimeout(500)

const printRoot = () => page.evaluate(() => document.getElementById('print-root').innerText)
const printHTML = () => page.evaluate(() => document.getElementById('print-root').innerHTML)
const tab = async (name, id = 1) => {
  await page.evaluate(([n, i]) => { location.hash = `#/offerings/${i}?tab=${n}` }, [name, id])
  await page.waitForTimeout(650)
}

// --- The certificate -------------------------------------------------------
{
  await tab('Certificates')
  await page.locator('#view button[aria-label="Print certificate 1"]').first().evaluate(b => b.click())
  await page.waitForTimeout(300)
  const text = await printRoot()
  const html = await printHTML()
  ok(/Certificate of Class A Units/.test(text), 'the certificate names what it certifies')
  ok(/No\.\s*1/.test(text), 'and carries its number')
  ok(/Rooke Family Trust/.test(text), 'and its holder')
  ok(/Cathedral Yard Holdings LLC/.test(text), 'and the issuer, not the offering name')
  ok(/60 units/.test(text), 'units are worked out from the capital and the unit price')
  ok(/60\.0000%/.test(text), 'the percentage of the issuer is on it')
  ok(/8% per annum, simple interest, actual\/365/.test(text),
    'the preferred return states the convention it accrues under')
  ok(/1 March 2026/.test(text), 'dates are set out in full')
  ok(/is not the instrument creating that interest/.test(text),
    'and the footer does not let it pass for the instrument itself')
  ok(/Bellweather & Rooke LLP/.test(text), 'the firm is named')
  ok(/cert-sig/.test(html), 'there is somewhere to sign')
  ok(await page.evaluate(() => window.__printed) === 1, 'printing was actually asked for')

  await page.waitForTimeout(1800)
  ok((await printRoot()).trim() === '', 'and the report is cleared afterwards, so it cannot print again by surprise')
}

// --- A cancelled certificate says so --------------------------------------
{
  await tab('Certificates')
  await page.locator('#view button', { hasText: 'Record a transfer' }).first().evaluate(b => b.click())
  await page.waitForTimeout(400)
  await page.locator('.modal select[name=from_certificate_id]').selectOption({ index: 1 })
  await page.waitForTimeout(200)
  await page.locator('.modal select[name=kind]').selectOption('redemption')
  await page.waitForTimeout(200)
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(900)
  // The redeemed certificate is off the roster, so print it from the record.
  const built = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('#view button')]
    return btns.some(b => /Print certificate/.test(b.getAttribute('aria-label') || ''))
  })
  ok(built, 'the roster still offers to print the certificates that remain')
  const roster = await page.locator('#view').innerText()
  ok(!/Rooke Family Trust/.test(roster.split('Transfers and redemptions')[0]),
    'a redeemed holding leaves the cap table')
  ok(/Redeemed/.test(roster), 'and shows on the transfer register')
}

// --- The holder's statement ------------------------------------------------
{
  await page.evaluate(() => { location.hash = '#/investors/2' })
  await page.waitForTimeout(600)
  await page.locator('#view button', { hasText: 'Print statement' }).first().evaluate(b => b.click())
  await page.waitForTimeout(300)
  const text = await printRoot()
  ok(/Holder’s statement/.test(text), 'the statement announces itself')
  ok(/Second Holder LLC/.test(text), 'for the holder it is about')
  ok(/Cathedral Yard Fund I/.test(text), 'listing the offerings they are on')
  ok(/\$40,000\.00/.test(text), 'what they committed')
  ok(/Certificates held/.test(text), 'the certificates they hold')
  ok(/Distributions received/.test(text) && /Q2 distribution/.test(text),
    'and what they have actually been paid')
  ok(/\$2,000\.00/.test(text), 'with the amount that was theirs')
  ok(/•••4321/.test(text) === false, 'a holder with no taxpayer number shows none')
  await page.waitForTimeout(1800)
  ok((await printRoot()).trim() === '', 'and it is cleared afterwards too')
}

// --- Taxpayer numbers stay masked on the statement -------------------------
{
  await page.evaluate(() => { location.hash = '#/investors/1' })
  await page.waitForTimeout(600)
  await page.locator('#view button', { hasText: 'Print statement' }).first().evaluate(b => b.click())
  await page.waitForTimeout(300)
  const text = await printRoot()
  ok(/•••4321/.test(text), 'the taxpayer number is masked on a printed statement')
  ok(!/987654321/.test(text), 'and does not appear in full')
  await page.waitForTimeout(1800)
}

// --- CSV -------------------------------------------------------------------
const grab = async (clickSel, label) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(clickSel, { hasText: 'CSV' }).first().evaluate(b => b.click()),
  ])
  const stream = await download.createReadStream()
  let text = ''
  for await (const chunk of stream) text += chunk
  return { name: download.suggestedFilename(), text }
}
{
  await tab('Investors')
  const { name, text } = await grab('#view button', 'roster')
  ok(/^cathedral-yard-fund-i-roster-\d{4}-\d{2}-\d{2}\.csv$/.test(name), `the roster file is named for the offering (${name})`)
  ok(text.charCodeAt(0) === 0xFEFF, 'it starts with a byte-order mark, so Excel reads it properly')
  ok(/\r\n/.test(text), 'and uses CRLF line endings')
  const lines = text.replace(/^﻿/, '').trim().split('\r\n')
  ok(lines[0].startsWith('Investor,Type,Status'), 'with a header row')
  ok(lines.length === 3, `and one row per subscriber (${lines.length - 1})`)
  ok(/,60000\.00,/.test(lines[1]), 'money is a plain decimal a spreadsheet can add up')
  ok(!/\$/.test(lines[1]), 'not a formatted string')
}
{
  await tab('Escrow')
  const { text } = await grab('#view button', 'escrow')
  const lines = text.replace(/^﻿/, '').trim().split('\r\n')
  ok(lines[0].includes('Signed amount'), 'the escrow ledger carries a signed column')
  const release = lines.find(l => l.startsWith('2026-03-01,release'))
  ok(/-100000\.00/.test(release), 'so a release totals into a balance as a negative')
}
{
  await tab('Certificates')
  const { text } = await grab('#view button', 'cap-table')
  const lines = text.replace(/^﻿/, '').trim().split('\r\n')
  ok(lines[0].startsWith('Certificate,Holder,Class'), 'the cap table has its own columns')
  ok(lines[0].includes('Outstanding'), 'including what is still owed')
  ok(lines.some(l => l.includes('Simple interest, actual/365')), 'and the convention each line accrued under')
}
{
  await page.evaluate(() => { location.hash = '#/investors' })
  await page.waitForTimeout(600)
  const { name, text } = await grab('#view button', 'contacts')
  ok(/^muniment-contacts-\d{4}-\d{2}-\d{2}\.csv$/.test(name), `the contact book exports under its own name (${name})`)
  ok(/•••4321/.test(text), 'taxpayer numbers are masked in the export')
  ok(!/987654321/.test(text), 'and never leave in full')
  ok(/SSN \/ EIN \(masked\)/.test(text), 'with a heading that says so')
}

// --- A value that looks like a formula is neutralised ----------------------
{
  await page.evaluate(() => { location.hash = '#/investors' })
  await page.waitForTimeout(400)
  await page.locator('#view button', { hasText: 'New investor' }).first().evaluate(b => b.click())
  await page.waitForTimeout(400)
  await page.locator('.modal select[name=entity_type]').selectOption('Entity')
  await page.waitForTimeout(200)
  await page.locator('.modal input[name=name]').fill('=1+1')
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(900)
  // Creating a contact opens it, so come back to the list that has the export.
  await page.evaluate(() => { location.hash = '#/investors' })
  await page.waitForTimeout(600)
  const { text } = await grab('#view button', 'contacts')
  ok(/'=1\+1/.test(text), 'a value beginning with = is quoted, so a spreadsheet will not run it')
}

await ctx.close()
await browser.close()
console.log('page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'))
if (fails.length || errors.length) {
  console.error(`\nDOCUMENTS FAILED — ${fails.length} assertion(s), ${errors.length} page error(s)`)
  process.exit(1)
}
console.log('\nDOCUMENTS OK')
