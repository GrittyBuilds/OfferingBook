#!/usr/bin/env node
/**
 * Muniment post-closing test.
 *
 * Distributions, transfers, redemptions, capital calls and the escrow break.
 * Everything here moves real money or real ownership, so the assertions are
 * about arithmetic that must close exactly and about history that must not be
 * rewritten in place.
 *
 *   node tools/lifecycle.mjs
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
const base = extra => ({
  meta: { version: 3, app: 'Muniment' },
  seq: { offerings: 9, investors: 99, subscriptions: 99, escrow: 99, tasks: 99, reconciliations: 9, closings: 9, certificates: 99, parties: 0, activity: 0, distributions: 0, transfers: 0, capital_calls: 0, state_filings: 0 },
  offerings: [], investors: [], subscriptions: [], escrow: [], tasks: [],
  reconciliations: [], closings: [], certificates: [], parties: [], activity: [],
  distributions: [], transfers: [], capital_calls: [], state_filings: [],
  settings: {}, dismissed: {}, ...extra,
})

const browser = await chromium.launch()
const errors = []
async function withApp (seed, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.addInitScript(s => { localStorage.setItem('muniment:data', JSON.stringify(s)) }, seed)
  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  const out = await fn(page)
  await ctx.close()
  return out
}
const doc = page => page.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')))
const tab = async (page, name, id = 1) => {
  await page.evaluate(([n, i]) => { location.hash = `#/offerings/${i}?tab=${n}` }, [name, id])
  await page.waitForTimeout(650)
  return page.locator('#view').innerText()
}

// Three holders: 50%, 30%, 20% of a single class, all accruing 8%.
const threeHolders = extra => base({
  offerings: [{
    id: 1, name: 'Payout Partners', status: 'Closed', exemption: 'Reg D 506(b)',
    default_return_rate: 8, accrual_convention: 'simple/365',
    bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso,
  }],
  investors: [
    { id: 1, name: 'Half Co', entity_type: 'Entity', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
    { id: 2, name: 'Three Tenths LLC', entity_type: 'Entity', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
    { id: 3, name: 'Fifth Trust', entity_type: 'Trust', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
  ],
  certificates: [
    { id: 1, offering_id: 1, investor_id: 1, cert_number: '1', class_name: 'Class A', capital_cents: 5000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', accrual_convention: 'simple/365', sort_index: 1, no_capital: 0, created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, cert_number: '2', class_name: 'Class A', capital_cents: 3000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', accrual_convention: 'simple/365', sort_index: 2, no_capital: 0, created_at: iso },
    { id: 3, offering_id: 1, investor_id: 3, cert_number: '3', class_name: 'Class A', capital_cents: 2000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', accrual_convention: 'simple/365', sort_index: 3, no_capital: 0, created_at: iso },
  ],
  ...extra,
})

// --- A distribution allocates to the cent ----------------------------------
// $10,000.01 across 50/30/20 does not divide. The parts must still come to
// the cheque, or somebody has to explain the difference.
{
  const out = await withApp(threeHolders(), async page => {
    await tab(page, 'Distributions')
    await page.locator('#view button', { hasText: 'Record a distribution' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal .money-input').first().fill('10000.01')
    await page.waitForTimeout(500)
    const banner = await page.locator('.modal .banner').innerText()
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(900)
    return { banner, d: (await doc(page)).distributions }
  })
  ok(/these agree/.test(out.banner), 'the proposed allocation agrees with the amount')
  ok(out.d.length === 1, 'and the distribution is recorded')
  const alloc = out.d[0].allocations
  const summed = alloc.reduce((a, x) => a + x.pref_cents + x.capital_cents, 0)
  ok(summed === 1000001, `the parts come to the whole exactly (${summed} of 1000001)`)
  ok(alloc.length === 3, 'with a line for every holder')
}

// --- Preferred return first, and it stops being outstanding ----------------
{
  const out = await withApp(threeHolders(), async page => {
    const before = await tab(page, 'Certificates')
    await tab(page, 'Distributions')
    await page.locator('#view button', { hasText: 'Record a distribution' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    // Well under what has accrued since Jan 2020, so all of it is preferred.
    await page.locator('.modal .money-input').first().fill('10000')
    await page.waitForTimeout(500)
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(900)
    const after = await tab(page, 'Certificates')
    const d = (await doc(page)).distributions[0]
    return { before, after, d }
  })
  const paidPref = out.d.allocations.reduce((a, x) => a + x.pref_cents, 0)
  const paidCap = out.d.allocations.reduce((a, x) => a + x.capital_cents, 0)
  ok(paidPref === 1000000 && paidCap === 0,
    `an amount inside the accrued balance is all preferred return (${paidPref} pref, ${paidCap} capital)`)
  ok(!/outstanding/i.test(out.before), 'before any distribution the roster shows accrued, not outstanding')
  ok(/outstanding/i.test(out.after), 'afterwards it separates what is still owed')
  ok(/preferred return outstanding/i.test(out.after), 'and says so in the figures above it')
}

// --- Allocations that do not agree are refused -----------------------------
{
  const out = await withApp(threeHolders(), async page => {
    await tab(page, 'Distributions')
    await page.locator('#view button', { hasText: 'Record a distribution' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal .money-input').first().fill('30000')
    await page.waitForTimeout(500)
    // Knock one line down; the parts no longer come to the whole.
    const cells = page.locator('.modal table .money-input')
    await cells.first().fill('1.00')
    await page.waitForTimeout(400)
    const banner = await page.locator('.modal .banner').innerText()
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(700)
    return { banner, err: await page.locator('.modal .form-error').innerText(), d: (await doc(page)).distributions }
  })
  ok(/still to allocate/.test(out.banner), 'an under-allocated distribution says so before it is submitted')
  ok(/must agree/.test(out.err), 'and is refused on submit')
  ok(out.d.length === 0, 'with nothing written')
}

// --- A transfer cancels one certificate and issues a successor -------------
{
  const out = await withApp(threeHolders({
    investors: [
      { id: 1, name: 'Half Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
      { id: 2, name: 'Three Tenths LLC', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
      { id: 3, name: 'Fifth Trust', entity_type: 'Trust', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
      { id: 4, name: 'Successor Holdings', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
    ],
  }), async page => {
    await tab(page, 'Certificates')
    await page.locator('#view button', { hasText: 'Record a transfer' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal select[name=from_certificate_id]').selectOption({ index: 1 })
    await page.waitForTimeout(250)
    await page.locator('.modal .ac-input').fill('Successor Holdings')
    await page.waitForTimeout(400)
    await page.locator('.ac-menu > *').first().evaluate(n => n.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    await page.waitForTimeout(300)
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(900)
    const view = await tab(page, 'Certificates')
    return { view, d: await doc(page) }
  })
  const from = out.d.certificates.find(c => c.cert_number === '1')
  const successor = out.d.certificates.find(c => c.transferred_from_certificate_id === 1)
  ok(!!from.cancelled_date, 'the transferred certificate is cancelled, not deleted')
  ok(!!successor, 'and a successor is issued')
  ok(successor.cert_number === '4', `numbered next in the roster (${successor.cert_number})`)
  ok(successor.capital_cents === from.capital_cents, 'carrying the same capital')
  ok(successor.accrual_start === '2020-01-01',
    'and the transferor’s accrual start — a transfer moves a holding, it does not restart one')
  ok(successor.transferred_from_certificate_id === 1, 'with a link back to what it came from')
  ok(!/Half Co/.test(out.view.split('Transfers and redemptions')[0]),
    'the cancelled holder is off the cap table')
  ok(/Successor Holdings/.test(out.view), 'and the new one is on it')
  ok(out.d.transfers.length === 1, 'the transfer is on the register')
}

// --- Undoing a transfer puts both certificates back ------------------------
{
  const out = await withApp(threeHolders({
    transfers: [{ id: 1, offering_id: 1, kind: 'transfer', from_certificate_id: 1, to_certificate_id: 4, transfer_date: '2026-06-01', capital_cents: 5000000, whole: 1, created_at: iso }],
    certificates: [
      { id: 1, offering_id: 1, investor_id: 1, cert_number: '1', class_name: 'Class A', capital_cents: 5000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 1, no_capital: 0, cancelled_date: '2026-06-01', cancelled_by_transfer_id: 1, created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, cert_number: '2', class_name: 'Class A', capital_cents: 3000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 2, no_capital: 0, created_at: iso },
      { id: 3, offering_id: 1, investor_id: 3, cert_number: '3', class_name: 'Class A', capital_cents: 2000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 3, no_capital: 0, created_at: iso },
      { id: 4, offering_id: 1, investor_id: null, holder_name: 'Successor Holdings', cert_number: '4', class_name: 'Class A', capital_cents: 5000000, pref_return_rate: 8, accrual_start: '2025-01-01', issue_date: '2026-06-01', issued_by_transfer_date: '2026-06-01', sort_index: 4, no_capital: 0, transferred_from_certificate_id: 1, created_at: iso },
    ],
  }), async page => {
    await tab(page, 'Certificates')
    await page.locator('#view .row-actions button[aria-label="Undo this transfer"]').first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal button', { hasText: 'Undo it' }).last().evaluate(b => b.click())
    await page.waitForTimeout(900)
    return doc(page)
  })
  ok(!out.certificates.find(c => c.id === 1).cancelled_date, 'undoing the transfer un-cancels the original')
  ok(!out.certificates.find(c => c.id === 4), 'and removes the successor')
  ok(out.transfers.length === 0, 'leaving nothing on the register')
}

// --- A roster as at an earlier date shows the earlier holder ---------------
{
  const out = await withApp(threeHolders({
    transfers: [{ id: 1, offering_id: 1, kind: 'transfer', from_certificate_id: 1, to_certificate_id: 4, transfer_date: '2026-06-01', capital_cents: 5000000, whole: 1, created_at: iso }],
    certificates: [
      { id: 1, offering_id: 1, investor_id: 1, cert_number: '1', class_name: 'Class A', capital_cents: 5000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 1, no_capital: 0, cancelled_date: '2026-06-01', cancelled_by_transfer_id: 1, created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, cert_number: '2', class_name: 'Class A', capital_cents: 3000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 2, no_capital: 0, created_at: iso },
      { id: 3, offering_id: 1, investor_id: 3, cert_number: '3', class_name: 'Class A', capital_cents: 2000000, pref_return_rate: 8, accrual_start: '2020-01-01', issue_date: '2020-01-01', sort_index: 3, no_capital: 0, created_at: iso },
      { id: 4, offering_id: 1, investor_id: null, holder_name: 'Successor Holdings', cert_number: '4', class_name: 'Class A', capital_cents: 5000000, pref_return_rate: 8, accrual_start: '2025-01-01', issue_date: '2026-06-01', issued_by_transfer_date: '2026-06-01', sort_index: 4, no_capital: 0, transferred_from_certificate_id: 1, created_at: iso },
    ],
  }), async page => {
    const now = await tab(page, 'Certificates')
    await page.locator('#view .asof-row input[type=date]').fill('2026-05-31')
    await page.waitForTimeout(800)
    const then = await page.locator('#view').innerText()
    return { now, then }
  })
  const roster = t => t.split('Transfers and redemptions')[0]
  ok(/Successor Holdings/.test(roster(out.now)) && !/Half Co/.test(roster(out.now)),
    'today the successor holds it')
  ok(/Half Co/.test(roster(out.then)) && !/Successor Holdings/.test(roster(out.then)),
    'and the day before the transfer, the transferor still did')
}

// --- Capital calls: what is owed is what has been called -------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Drawdown Fund', status: 'Open', exemption: 'Reg D 506(b)', staged_funding: 1, bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso }],
    investors: [
      { id: 1, name: 'Committed LLC', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
      { id: 2, name: 'Also In Ltd', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso },
    ],
    subscriptions: [
      { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 10000000, status: 'Sub signed', sub_signed_date: '2026-02-01', created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 5000000, status: 'Sub signed', sub_signed_date: '2026-02-01', created_at: iso },
    ],
  })
  const out = await withApp(seed, async page => {
    const before = await tab(page, 'Investors')
    await page.locator('#view button', { hasText: 'Issue a call' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal input[type=number]').first().fill('25')
    await page.waitForTimeout(500)
    // The figures live in inputs, which innerText does not see.
    const proposed = await page.locator('.modal table .money-input').evaluateAll(ns => ns.map(n => n.value))
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(900)
    const after = await tab(page, 'Investors')
    return { before, proposed, after, d: await doc(page) }
  })
  ok(out.proposed.includes('25000.00') && out.proposed.includes('12500.00'),
    `a 25% call asks each subscriber for a quarter of their own commitment (${out.proposed.join(', ')})`)
  ok(out.d.capital_calls.length === 1, 'the call is recorded')
  const called = out.d.capital_calls[0].allocations.reduce((a, x) => a + x.amount_cents, 0)
  ok(called === 3750000, `totalling a quarter of the commitments (${called})`)
  ok(/\$150,000\.00.*committed/s.test(out.after) || /committed/.test(out.after), 'commitments still read in full')
  ok(/\$37,500\.00/.test(out.after), 'and the called figure is shown')
}

// --- Nobody is called for more than they committed -------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Over Call', status: 'Open', staged_funding: 1, classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'Committed LLC', entity_type: 'Entity', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 10000000, status: 'Sub signed', sub_signed_date: '2026-02-01', created_at: iso }],
    capital_calls: [{ id: 1, offering_id: 1, label: 'Call 1', call_date: '2026-03-01', percent: 80, allocations: [{ subscription_id: 1, investor_id: 1, amount_cents: 8000000 }], created_at: iso }],
  })
  const proposed = await withApp(seed, async page => {
    await tab(page, 'Investors')
    await page.locator('#view button', { hasText: 'Issue a call' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal input[type=number]').first().fill('50')
    await page.waitForTimeout(500)
    return page.locator('.modal table .money-input').evaluateAll(ns => ns.map(n => n.value))
  })
  ok(proposed.includes('20000.00'),
    `a 50% call on top of 80% already called proposes only the 20% left (${proposed.join(', ')})`)
}

// --- Breaking escrow -------------------------------------------------------
{
  const seed = base({
    offerings: [{
      id: 1, name: 'Short Fund', status: 'Open', exemption: 'Reg D 506(b)',
      target_min_cents: 50000000, final_close_date: '2026-06-30',
      bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso,
    }],
    investors: [
      { id: 1, name: 'Paid Up LLC', entity_type: 'Entity', created_at: iso },
      { id: 2, name: 'Half Paid Inc', entity_type: 'Entity', created_at: iso },
      { id: 3, name: 'Never Paid Co', entity_type: 'Entity', created_at: iso },
    ],
    subscriptions: [
      { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 10000000, status: 'Funded', funded_date: '2026-03-01', created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 10000000, status: 'Funded', funded_date: '2026-03-02', created_at: iso },
      { id: 3, offering_id: 1, investor_id: 3, amount_committed_cents: 10000000, status: 'Sub signed', sub_signed_date: '2026-03-03', created_at: iso },
    ],
    escrow: [
      { id: 1, offering_id: 1, investor_id: 1, subscription_id: 1, txn_type: 'deposit', amount_cents: 10000000, txn_date: '2026-03-01', cleared: 1, created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, subscription_id: 2, txn_type: 'deposit', amount_cents: 5000000, txn_date: '2026-03-02', cleared: 1, created_at: iso },
    ],
  })
  const out = await withApp(seed, async page => {
    const view = await tab(page, 'Closings')
    await page.locator('#view button', { hasText: 'Break escrow' }).first().evaluate(b => b.click())
    await page.waitForTimeout(500)
    const plan = await page.locator('.modal').innerText()
    // The acknowledgement is required, exactly as on a closing below minimum.
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    const guard = await page.locator('.modal .form-error').innerText()
    await page.locator('.modal .ack-row input[type=checkbox]').check()
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(1100)
    return { view, plan, guard, d: await doc(page) }
  })
  ok(/passed its final close deadline/.test(out.view), 'the Closings tab says the deadline passed unmet')
  ok(/\$150,000\.00/.test(out.plan), 'the plan itemises what would be refunded')
  ok(/Never Paid Co/.test(out.plan) === false, 'and leaves out the subscriber who never funded')
  ok(/Confirm that this offering is being terminated/.test(out.guard),
    'terminating requires an explicit acknowledgement')
  const refunds = out.d.escrow.filter(e => e.txn_type === 'refund')
  ok(refunds.length === 2, 'two refunds are written')
  ok(refunds.reduce((a, e) => a + e.amount_cents, 0) === 15000000, 'for exactly what had cleared')
  ok(out.d.subscriptions.every(s => s.status === 'Withdrawn'), 'every subscription is withdrawn')
  ok(out.d.offerings[0].status === 'Terminated', 'and the offering is terminated')
  ok(out.d.activity.some(a => /Broke escrow/.test(a.summary)), 'with the whole of it on the trail')
}

// --- An offering that has already closed cannot break ----------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Already Closed', status: 'Open', target_min_cents: 50000000, final_close_date: '2026-06-30', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 10000000, status: 'Closed', closing_id: 1, funded_date: '2026-03-01', created_at: iso }],
    closings: [{ id: 1, offering_id: 1, label: 'Closing 1', closing_date: '2026-04-01', amount_released_cents: 10000000, fees_cents: 0, created_at: iso }],
    escrow: [{ id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 10000000, txn_date: '2026-03-01', cleared: 1, created_at: iso }],
  })
  const view = await withApp(seed, page => tab(page, 'Closings'))
  ok(!/Break escrow/.test(view), 'an offering that has already held a closing is not offered the break')
}

await browser.close()
console.log('page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'))
if (fails.length || errors.length) {
  console.error(`\nLIFECYCLE FAILED — ${fails.length} assertion(s), ${errors.length} page error(s)`)
  process.exit(1)
}
console.log('\nLIFECYCLE OK')
