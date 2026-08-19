#!/usr/bin/env node
/**
 * Muniment exemption test.
 *
 * The checks that read the record and say where it puts the offering: the
 * Form D clock, the 506(b) ceiling, 506(c) verification, the bad-actor
 * inquiry, and which states the roster has put in play.
 *
 * Every case here is a fact the app already held and used to say nothing
 * about. What is asserted is that it says something, and that what it says is
 * derived from the right fact — not that it gives advice, which it does not.
 *
 *   node tools/exemption.mjs
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
  seq: { offerings: 9, investors: 99, subscriptions: 99, escrow: 99, tasks: 99, reconciliations: 9, closings: 9, certificates: 9, parties: 0, activity: 0, distributions: 0, transfers: 0, capital_calls: 0, state_filings: 0 },
  offerings: [], investors: [], subscriptions: [], escrow: [], tasks: [],
  reconciliations: [], closings: [], certificates: [], parties: [], activity: [],
  distributions: [], transfers: [], capital_calls: [], state_filings: [],
  settings: {}, dismissed: {}, ...extra,
})

const browser = await chromium.launch()
const errors = []
async function withApp (seed, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
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
// Everything in the strip, with the hidden rest opened.
const strip = async page => {
  await page.evaluate(() => { location.hash = '#/' })
  await page.waitForTimeout(500)
  const more = page.locator('.suggest-panel button', { hasText: 'Show all' })
  if (await more.count()) { await more.first().evaluate(b => b.click()); await page.waitForTimeout(300) }
  return (await page.locator('#view').count()) ? page.locator('#view').innerText() : ''
}
const filings = async (page, id = 1) => {
  await page.evaluate(n => { location.hash = `#/offerings/${n}?tab=Filings` }, id)
  await page.waitForTimeout(600)
  return page.locator('#view').innerText()
}

// --- The Form D clock runs from the first sale -----------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Clockwork Fund', status: 'Open', exemption: 'Reg D 506(b)', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'Early Bird LLC', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso }],
    // Signed on the 3rd, money cleared on the 10th. The clock runs from the 3rd.
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 5000000, status: 'Funded', sub_signed_date: '2026-03-03', funded_date: '2026-03-10', created_at: iso }],
    escrow: [{ id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 5000000, txn_date: '2026-03-10', cleared: 1, created_at: iso }],
  })
  const text = await withApp(seed, page => filings(page))
  ok(/3 Mar 2026/.test(text), 'first sale is taken from the earliest signed subscription')
  ok(/earliest signed subscription/.test(text), 'and the screen says which fact fixed it')
  ok(/18 Mar 2026/.test(text), 'the Form D deadline is fifteen days after it')
  ok(/Overdue/i.test(text), 'and an unfiled, long-past deadline reads as overdue')
}

// --- With no signed date, the cleared deposit fixes it ---------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Wire First', status: 'Open', exemption: 'Reg D 506(c)', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'Wirer Inc', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Funded', funded_date: '2026-04-07', created_at: iso }],
    escrow: [{ id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 100000, txn_date: '2026-04-07', cleared: 1, created_at: iso }],
  })
  const text = await withApp(seed, page => filings(page))
  ok(/earliest cleared deposit/.test(text), 'with nothing signed, the cleared deposit fixes the first sale')
  ok(/22 Apr 2026/.test(text), 'and the deadline follows from it')
}

// --- A filed Form D stops the nagging and reports lateness once ------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Filed On Time', status: 'Open', exemption: 'Reg D 506(b)', form_d_filed_date: '2026-03-11', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-03-03', created_at: iso }],
  })
  const [text, dash] = await withApp(seed, async page => [await filings(page), await strip(page)])
  ok(/Filed 11 Mar 2026/.test(text), 'a filed Form D reports as filed')
  ok(!/Overdue/i.test(text), 'and is not still called overdue')
  ok(!/Form D on Filed On Time is due/.test(dash), 'and drops off the suggestion strip')
}

// --- 506(b): the ceiling, and what one non-accredited purchaser brings -----
{
  const many = n => Array.from({ length: n }, (_, k) => k + 1)
  const seed = base({
    offerings: [{ id: 1, name: 'Crowded Room', status: 'Open', exemption: 'Reg D 506(b)', classes: [], tranches: [], created_at: iso }],
    investors: many(37).map(n => ({ id: n, name: `Holder ${n}`, entity_type: 'Entity', accredited_status: 'Not accredited', created_at: iso })),
    subscriptions: many(37).map(n => ({ id: n, offering_id: 1, investor_id: n, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso })),
  })
  const [dash, text] = await withApp(seed, async page => [await strip(page), await filings(page)])
  ok(/37 non-accredited purchasers/.test(dash), 'thirty-seven non-accredited purchasers are counted')
  ok(/no more than 35/.test(dash), 'against the ceiling Rule 506(b) sets')
  ok(/502\(b\) information/.test(dash), 'and the information-delivery obligation is raised')
  ok(/37 of 35 allowed/.test(text), 'the filings screen states the position too')
}

// --- 506(b) plus general solicitation is a contradiction -------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Advertised', status: 'Open', exemption: 'Reg D 506(b)', general_solicitation: 1, bad_actor_checked_date: '2026-01-05', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso }],
  })
  const dash = await withApp(seed, page => strip(page))
  ok(/generally solicited under 506\(b\)/.test(dash), 'a solicited 506(b) offering is flagged')
}

// --- 506(c): self-certification does not satisfy it ------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Verify Everyone', status: 'Open', exemption: 'Reg D 506(c)', bad_actor_checked_date: '2026-01-05', classes: [], tranches: [], created_at: iso }],
    investors: [
      { id: 1, name: 'Verified Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-05-01', accreditation_basis: 'Net worth', accredited_evidence_date: '2026-05-01', created_at: iso },
      { id: 2, name: 'Trust Me LLC', entity_type: 'Entity', accredited_status: 'Self-certified', created_at: iso },
      { id: 3, name: 'Unknown Holdings', entity_type: 'Entity', accredited_status: 'Unknown', created_at: iso },
    ],
    subscriptions: [1, 2, 3].map(n => ({ id: n, offering_id: 1, investor_id: n, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso })),
  })
  const card = await withApp(seed, async page => {
    await strip(page)
    return page.locator('.suggest-card', { hasText: 'not verified' }).innerText()
  })
  ok(/2 purchasers on Verify Everyone are not verified/.test(card),
    'self-certified and unrecorded purchasers are both counted as unverified')
  ok(/Self-certification does not satisfy it/.test(card), 'and the reason is stated')
  ok(/Trust Me LLC/.test(card) && /Unknown Holdings/.test(card), 'and both are named')
  ok(!/Verified Co/.test(card), 'while the verified holder is not among them')
}

// --- The bad-actor inquiry ------------------------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'No Inquiry', status: 'Open', exemption: 'Reg D 506(b)', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-01-02', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso }],
  })
  const [dash, text] = await withApp(seed, async page => [await strip(page), await filings(page)])
  ok(/No bad-actor inquiry is recorded/.test(dash), 'a missing 506(d) inquiry is raised')
  ok(/Not recorded/.test(text), 'and the filings screen shows it as not recorded')
}

// --- Blue sky: the roster puts states in play ------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Three States', status: 'Open', exemption: 'Reg D 506(b)', bad_actor_checked_date: '2026-01-05', classes: [], tranches: [], created_at: iso }],
    investors: [
      { id: 1, name: 'Michigan Co', entity_type: 'Entity', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-05-20', created_at: iso },
      // No state field: read off the tail of the address, ZIP and all.
      { id: 2, name: 'Ohio Trust', entity_type: 'Trust', address: '44 Elm Street, Columbus, OH 43004', accredited_status: 'Verified', accredited_verified_date: '2026-05-20', created_at: iso },
      { id: 3, name: 'Nowhere Ltd', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-05-20', created_at: iso },
    ],
    subscriptions: [1, 2, 3].map(n => ({ id: n, offering_id: 1, investor_id: n, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-25', created_at: iso })),
  })
  const out = await withApp(seed, async page => {
    const dash = await strip(page)
    const before = await filings(page)
    // Accepting the proposal opens a row per state, dated by nobody.
    await page.evaluate(() => { location.hash = '#/' }); await page.waitForTimeout(400)
    const more = page.locator('.suggest-panel button', { hasText: 'Show all' })
    if (await more.count()) { await more.first().evaluate(b => b.click()); await page.waitForTimeout(250) }
    const card = page.locator('.suggest-card', { hasText: 'no notice filing recorded' })
    const had = await card.count()
    if (had) { await card.locator('button', { hasText: 'Accept' }).first().evaluate(b => b.click()); await page.waitForTimeout(700) }
    const after = await filings(page)
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')).state_filings)
    return { dash, before, after, had, rows }
  })
  ok(/2 states on Three States have no notice filing/.test(out.dash),
    'the states the roster puts in play are counted')
  ok(/Michigan/.test(out.dash) && /Ohio/.test(out.dash), 'named, including one read off an address')
  ok(out.had === 1, 'and the proposal is on the strip')
  ok(out.rows.length === 2, 'accepting it opens one row per state')
  ok(out.rows.every(r => r.filed_date === null), 'and claims nothing as filed')
  ok(/no state recorded/.test(out.after), 'the subscriber with no state is called out separately')
}

// --- Accreditation evidence goes stale ------------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Stale Evidence', status: 'Open', exemption: 'Reg D 506(c)', bad_actor_checked_date: '2026-01-05', classes: [], tranches: [], created_at: iso }],
    investors: [{
      id: 1, name: 'Long Ago LLC', entity_type: 'Entity', accredited_status: 'Verified',
      accredited_verified_date: '2020-01-01', accreditation_basis: 'Net worth', accredited_evidence_date: '2020-01-01', created_at: iso,
    }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso }],
  })
  const dash = await withApp(seed, page => strip(page))
  ok(/accreditation evidence is \d+ days old/.test(dash), 'stale verification evidence is raised')
  ok(/house standard|would re-verify/.test(dash), 'and is described as a house standard rather than a rule')
}

// --- Nothing is said where nothing applies --------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Reg S Deal', status: 'Open', exemption: 'Reg S', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'Offshore Co', entity_type: 'Entity', accredited_status: 'Verified', accredited_verified_date: '2026-05-20', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-05-01', created_at: iso }],
  })
  const [dash, text] = await withApp(seed, async page => [await strip(page), await filings(page)])
  ok(!/Form D/.test(dash), 'a non-Reg-D offering is not told about Form D')
  ok(!/bad-actor/.test(dash), 'nor about the 506(d) inquiry')
  ok(/does not call for a Form D/.test(text), 'and the filings screen says why it is empty')
}

await browser.close()
console.log('page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'))
if (fails.length || errors.length) {
  console.error(`\nEXEMPTION FAILED — ${fails.length} assertion(s), ${errors.length} page error(s)`)
  process.exit(1)
}
console.log('\nEXEMPTION OK')
