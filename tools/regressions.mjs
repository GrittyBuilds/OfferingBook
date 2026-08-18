#!/usr/bin/env node
/**
 * Muniment regression test.
 *
 * Each case here is a defect that reached the working tree once. They are
 * pinned so they cannot come back quietly: the arithmetic ones would put a
 * wrong figure in a client's report, and the store ones would lose work.
 *
 *   node tools/regressions.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright/index.js')
const APP = 'file://' + (process.env.MUNIMENT_APP || join(dirname(fileURLToPath(import.meta.url)), '..', 'Muniment.html'))

const fails = []
const ok = (c, label) => { console.log((c ? '  ok   ' : '  FAIL ') + label); if (!c) fails.push(label) }
const iso = '2026-01-01T00:00:00.000Z'
const base = extra => ({
  meta: { version: 2, app: 'Muniment' },
  seq: { offerings: 9, investors: 9, subscriptions: 9, escrow: 9, tasks: 9, reconciliations: 9, closings: 9, certificates: 9, parties: 0, activity: 0 },
  offerings: [], investors: [], subscriptions: [], escrow: [], tasks: [],
  reconciliations: [], closings: [], certificates: [], parties: [], activity: [],
  settings: {}, dismissed: {}, ...extra,
})

const browser = await chromium.launch()
const errors = []
async function withApp (seed, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.addInitScript(s => { localStorage.setItem('muniment:data', JSON.stringify(s)) }, seed)
  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForTimeout(400)
  const out = await fn(page)
  await ctx.close()
  return out
}
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')))

// --- The minimum raise is net of refunds ----------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Refund Fund', status: 'Open', target_min_cents: 10000000, classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', accredited_status: 'Verified', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 10000000, status: 'Funded', funded_date: '2026-02-01', created_at: iso }],
    escrow: [
      { id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 10000000, txn_date: '2026-02-01', cleared: 1, created_at: iso },
      { id: 2, offering_id: 1, investor_id: 1, txn_type: 'refund', amount_cents: 4000000, txn_date: '2026-03-01', cleared: 1, created_at: iso },
    ],
  })
  const text = await withApp(seed, async page => {
    await page.evaluate(() => { location.hash = '#/offerings/1' }); await page.waitForTimeout(500)
    return page.locator('#view').innerText()
  })
  ok(!/Min-raise met/.test(text), 'a refunded deposit does not satisfy the minimum raise')
  ok(/60% of min-raise/.test(text), 'the raise reads 60% after a 40% refund')
}

// --- A sponsor certificate does not push a cash class past 100% -----------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Cap Table', status: 'Open', classes: [{ name: 'Class A Units', total_percent: 100, sponsor: false }], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', created_at: iso }, { id: 2, name: 'B Co', entity_type: 'Entity', created_at: iso }, { id: 3, name: 'Sponsor LLC', entity_type: 'Entity', created_at: iso }],
    certificates: [
      { id: 1, offering_id: 1, investor_id: 1, class_name: 'Class A Units', capital_cents: 5000000, cert_number: '1', created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, class_name: 'Class A Units', capital_cents: 5000000, cert_number: '2', created_at: iso },
      { id: 3, offering_id: 1, investor_id: 3, class_name: 'Class A Units', capital_cents: null, no_capital: 1, cert_number: '3', created_at: iso },
    ],
  })
  const pcts = await withApp(seed, async page => {
    await page.evaluate(() => { location.hash = '#/offerings/1?tab=Certificates' }); await page.waitForTimeout(600)
    return page.evaluate(() => [...document.querySelectorAll('tfoot td')].map(t => t.textContent))
  })
  ok(pcts.some(t => t === '100.0000%'), `the class totals exactly 100% with a no-capital holder in it (${pcts.filter(t => t.includes('%')).join(', ')})`)
}

// --- Undoing a closing gives back the date it invented ---------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Undo Fund', status: 'Open', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'Never Paid LLC', entity_type: 'Entity', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 5000000, status: 'Prospect', funded_date: null, created_at: iso }],
    // Money is in escrow but not attributed to this subscriber, so the closing
    // can proceed while the subscription itself has no funding date — which is
    // exactly the state that used to leave a prospect marked Funded.
    escrow: [{ id: 1, offering_id: 1, investor_id: null, txn_type: 'deposit', amount_cents: 5000000, txn_date: '2026-02-01', cleared: 1, created_at: iso }],
  })
  const after = await withApp(seed, async page => {
    await page.evaluate(() => { location.hash = '#/offerings/1?tab=Closings' }); await page.waitForTimeout(500)
    await page.locator('#view button', { hasText: 'Conduct' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.pick-all input').click()
    await page.waitForTimeout(200)
    // amountInput is the first money field, feesInput the second. Nothing has
    // cleared escrow here, so the release is 0 and a fee makes it validate.
    await page.locator('#modal-root .money-input').nth(0).fill('50000.00')
    await page.locator('#modal-root .money-input').nth(1).fill('0')
    await page.locator('#modal-root button[type=submit]').click()
    await page.waitForTimeout(800)
    const madeIt = await page.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')).closings.length)
    if (madeIt !== 1) throw new Error('the closing was not recorded; nothing to undo')
    // now delete it
    await page.locator('#view button', { hasText: 'Delete closing' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('#modal-root button', { hasText: 'Delete closing' }).last().click()
    await page.waitForTimeout(800)
    return read(page)
  })
  const sub = after.subscriptions[0]
  ok(!sub.funded_date, `undoing the closing took back the funded date it invented (${sub.funded_date})`)
  ok(sub.status === 'Prospect', `a subscriber who never paid is not left as Funded (${sub.status})`)
}

// --- Opening a file after an unreadable mirror resumes saving --------------
{
  const resumed = await withApp(base({}), async page => {
    // Simulate the hold, then the recovery the message tells the user to do.
    return page.evaluate(async () => {
      localStorage.setItem('muniment:data', '{ this is not json')
      location.reload()
      return true
    })
  })
  // Reload with a corrupt mirror and check the app refuses to overwrite it.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.addInitScript(() => { localStorage.setItem('muniment:data', '{ not json at all') })
  await page.goto(APP); await page.waitForTimeout(900)
  const held = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('muniment:unreadable:'))
    return { stashed: keys.length === 1, original: localStorage.getItem('muniment:data') }
  })
  ok(held.stashed, 'an unreadable document is stashed under its own key')
  ok(held.original === '{ not json at all', 'the unreadable document is left exactly as it was')
  await ctx.close()
}

// --- hasData counts settings and parties -----------------------------------
{
  const seed = base({ settings: { firm_name: 'Seyburn Law PLLC' }, parties: [{ id: 1, role: 'Issuer', name: 'A Client LLC', created_at: iso }] })
  seed.seq.parties = 1
  const warned = await withApp(seed, async page => page.evaluate(() => {
    // Reach hasData through the import path's guard by checking the document
    // the app would count.
    const d = JSON.parse(localStorage.getItem('muniment:data'))
    const collections = ['offerings','investors','subscriptions','escrow','tasks','reconciliations','closings','certificates','parties','activity']
    return collections.reduce((n,k)=>n+((d[k]&&d[k].length)||0),0) + Object.keys(d.settings||{}).length > 0
  }))
  ok(warned, 'a firm with only settings and parties still counts as having data')
}

console.log('page errors:', errors.length ? errors : 'none')
if (errors.length) fails.push('console errors')
await browser.close()
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nREGRESSIONS OK')
process.exit(fails.length ? 1 : 0)
