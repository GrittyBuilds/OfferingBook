#!/usr/bin/env node
/**
 * Muniment workflow test.
 *
 * Sorting, the escrow filter, the pasted contact list, derived checklist
 * dates, and the attention view.
 *
 *   node tools/workflow.mjs
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
const tab = async (page, name, id = 1) => {
  await page.evaluate(([n, i]) => { location.hash = `#/offerings/${i}?tab=${n}` }, [name, id])
  await page.waitForTimeout(650)
}
// The primary column of every visible row, in the order they appear.
const column = (page, n = 0) => page.evaluate(i => {
  const body = document.querySelector('#view tbody')
  return [...body.rows].filter(r => r.style.display !== 'none')
    .map(r => (r.cells[i] ? r.cells[i].innerText.split('\n')[0].trim() : ''))
}, n)

const roster = base({
  offerings: [{ id: 1, name: 'Sortable Fund', status: 'Open', exemption: 'Reg D 506(b)', bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso }],
  investors: [
    { id: 1, name: 'Zebra Holdings', entity_type: 'Entity', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-05', created_at: iso },
    { id: 2, name: 'Apple Trust', entity_type: 'Trust', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-05', created_at: iso },
    { id: 3, name: 'Middle Co', entity_type: 'Entity', state: 'MI', accredited_status: 'Verified', accredited_verified_date: '2026-01-05', created_at: iso },
  ],
  subscriptions: [
    { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-03-01', created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 900000, status: 'Sub signed', sub_signed_date: '2026-03-02', created_at: iso },
    { id: 3, offering_id: 1, investor_id: 3, amount_committed_cents: 500000, status: 'Sub signed', sub_signed_date: '2026-03-03', created_at: iso },
  ],
})

// --- Sorting ---------------------------------------------------------------
{
  const out = await withApp(roster, async page => {
    await tab(page, 'Investors')
    const natural = await column(page)
    const head = page.locator('#view th', { hasText: 'Committed' }).locator('button')
    await head.evaluate(b => b.click()); await page.waitForTimeout(250)
    const asc = await column(page)
    const ascending = await page.locator('#view th[data-sorted="asc"]').count()
    await head.evaluate(b => b.click()); await page.waitForTimeout(250)
    const desc = await column(page)
    await head.evaluate(b => b.click()); await page.waitForTimeout(250)
    const back = await column(page)
    return { natural, asc, desc, back, ascending }
  })
  // The record's own order for a roster is by name; what matters is that it is
  // stable, and that a third click comes back to it.
  ok(out.natural.join() === 'Apple Trust,Middle Co,Zebra Holdings', 'the roster starts in the order the record holds it')
  ok(out.ascending === 1, 'a sorted column says which way it is pointing')
  ok(out.asc.join() === 'Zebra Holdings,Middle Co,Apple Trust', 'one click sorts ascending by the committed amount')
  ok(out.desc.join() === 'Apple Trust,Middle Co,Zebra Holdings', 'a second click reverses it')
  ok(out.back.join() === out.natural.join(), 'and a third returns the order the file is in')
}

// --- A column with no order worth having is not clickable ------------------
{
  const out = await withApp(base({
    offerings: [{ id: 1, name: 'Numbered', status: 'Closed', classes: [], tranches: [], created_at: iso }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', created_at: iso }],
    certificates: [1, 2].map(n => ({ id: n, offering_id: 1, investor_id: 1, cert_number: String(n), class_name: 'Class A', capital_cents: n * 100000, sort_index: n, no_capital: 0, created_at: iso })),
  }), async page => {
    await tab(page, 'Certificates')
    return page.evaluate(() => {
      const ths = [...document.querySelectorAll('#view th')]
      const find = t => ths.find(x => x.innerText.trim().toUpperCase().startsWith(t))
      return { cert: !!(find('CERT #') || {}).querySelector?.('button'), capital: !!(find('CAPITAL') || {}).querySelector?.('button') }
    })
  })
  ok(out.capital === true, 'capital can be sorted')
  ok(out.cert === false, 'the certificate number cannot — its order is the record’s, not the reader’s')
}

// --- The escrow filter -----------------------------------------------------
{
  const seed = base({
    offerings: [{ id: 1, name: 'Busy Escrow', status: 'Open', classes: [], tranches: [], created_at: iso }],
    investors: [
      { id: 1, name: 'Wirer LLC', entity_type: 'Entity', created_at: iso },
      { id: 2, name: 'Chequer Inc', entity_type: 'Entity', created_at: iso },
    ],
    subscriptions: [
      { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 500000, status: 'Funded', funded_date: '2026-02-01', created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 500000, status: 'Funded', funded_date: '2026-04-01', created_at: iso },
    ],
    escrow: [
      { id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 500000, txn_date: '2026-02-01', method: 'Wire', reference: 'FED-111', cleared: 1, created_at: iso },
      { id: 2, offering_id: 1, investor_id: 2, txn_type: 'deposit', amount_cents: 500000, txn_date: '2026-04-01', method: 'Check', reference: 'CHK-222', cleared: 0, created_at: iso },
      { id: 3, offering_id: 1, investor_id: null, txn_type: 'fee', amount_cents: 25000, txn_date: '2026-05-01', cleared: 1, created_at: iso },
      { id: 4, offering_id: 1, investor_id: 1, txn_type: 'refund', amount_cents: 100000, txn_date: '2026-06-01', cleared: 1, created_at: iso },
    ],
  })
  const out = await withApp(seed, async page => {
    await tab(page, 'Escrow')
    const all = (await column(page)).length
    // Type: deposits only.
    await page.locator('#view select[aria-label="Entry type"]').selectOption('deposit')
    await page.waitForTimeout(500)
    const deposits = await column(page)
    await page.locator('#view select[aria-label="Entry type"]').selectOption('')
    await page.waitForTimeout(500)
    // Cleared only.
    await page.locator('#view select[aria-label="Cleared or pending"]').selectOption('pending')
    await page.waitForTimeout(500)
    const pending = await column(page)
    const pendingCount = await page.locator('#view .filter-count').innerText()
    await page.locator('#view select[aria-label="Cleared or pending"]').selectOption('')
    await page.waitForTimeout(500)
    // A date range.
    const dates = page.locator('#view .filter-dates input[type=date]')
    await dates.nth(0).fill('2026-04-01')
    await page.waitForTimeout(500)
    const fromApril = (await column(page)).length
    await dates.nth(0).fill('')
    // Clearing a structural filter redraws the tab, which replaces the search
    // box. Let that settle before typing into it, or the focus check below is
    // measuring the redraw rather than the search.
    await page.waitForTimeout(900)
    // And the text search, which hides in place rather than redrawing.
    await page.locator('#view input[type=search]').fill('FED-111')
    await page.waitForTimeout(350)
    const searched = await column(page)
    const searchCount = await page.locator('#view .filter-count').innerText()
    const stillFocused = await page.evaluate(() => ({
      tag: document.activeElement.tagName, type: document.activeElement.type || '',
    }))
    return { all, deposits, pending, pendingCount, fromApril, searched, searchCount, stillFocused }
  })
  ok(out.all === 4, 'the ledger starts with everything on it')
  ok(out.deposits.length === 2, 'filtering to deposits leaves the two deposits')
  ok(out.pending.length === 1 && out.pending[0] === 'Chequer Inc', 'and to pending, the one that has not cleared')
  ok(/1 of 4 entries/.test(out.pendingCount), 'the count says how much of the ledger is showing')
  ok(out.fromApril === 3, 'a from-date drops what came before it')
  ok(out.searched.length === 1 && out.searched[0] === 'Wirer LLC', 'the search matches on a reference')
  ok(/1 of 4 entries/.test(out.searchCount), 'and re-counts what is left')
  ok(out.stillFocused.type === 'search',
    `typing in the search box does not take the cursor away from it (focus was on ${out.stillFocused.tag}${out.stillFocused.type ? '[' + out.stillFocused.type + ']' : ''})`)
}

// --- Pasting a list of contacts -------------------------------------------
{
  const seed = base({
    investors: [{ id: 1, name: 'Already Here LLC', entity_type: 'Entity', email: 'here@example.test', created_at: iso }],
  })
  const out = await withApp(seed, async page => {
    await page.evaluate(() => { location.hash = '#/investors' })
    await page.waitForTimeout(500)
    await page.locator('#view button', { hasText: 'Paste a list' }).first().evaluate(b => b.click())
    await page.waitForTimeout(400)
    await page.locator('.modal textarea').fill([
      'Jane Q Public, jane@example.test, MI',
      'Acme Holdings LLC; 38-1234567; contact@acme.test',
      'Rooke Family Trust\tOH',
      'Already Here LLC, here@example.test',
      '',
    ].join('\n'))
    await page.waitForTimeout(500)
    const preview = await page.locator('.modal').innerText()
    await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
    await page.waitForTimeout(1400)
    return { preview, d: await page.evaluate(() => JSON.parse(localStorage.getItem('muniment:data'))) }
  })
  ok(/4 rows|3 to add/.test(out.preview), 'the preview says how many will be added')
  ok(/already on file and left alone/.test(out.preview), 'and that one of them is already known')
  const inv = out.d.investors
  ok(inv.length === 4, `three were added, the duplicate was not (${inv.length} in the book)`)
  const jane = inv.find(i => i.last_name === 'Public')
  ok(jane && jane.first_name === 'Jane' && jane.middle_name === 'Q', 'a personal name is split into its parts')
  ok(jane && jane.entity_type === 'Individual', 'and filed as an individual')
  ok(jane && jane.email === 'jane@example.test', 'the email is recognised by its shape')
  ok(jane && jane.state === 'MI', 'and a two-letter state by its')
  const acme = inv.find(i => i.name === 'Acme Holdings LLC')
  ok(acme && acme.entity_type === 'Entity', 'a name ending LLC is filed as an entity')
  ok(acme && acme.tax_id === '38-1234567', 'and its EIN is picked out of the middle of the line')
  const trust = inv.find(i => i.name === 'Rooke Family Trust')
  ok(trust && trust.entity_type === 'Trust' && trust.state === 'OH', 'a tab-separated trust comes through too')
}

// --- Checklist dates the offering implies ---------------------------------
{
  const seed = base({
    offerings: [{
      id: 1, name: 'Dated Fund', status: 'Open', exemption: 'Reg D 506(b)',
      launch_date: '2026-01-15', first_close_date: '2026-09-30', final_close_date: '2026-12-31',
      bad_actor_checked_date: '2026-01-02', classes: [], tranches: [], created_at: iso,
    }],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', created_at: iso }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-03-03', created_at: iso }],
    tasks: [
      { id: 1, offering_id: 1, label: 'File Form D with the SEC', proves: 'form_d', done: 0, sort_order: 1, created_at: iso },
      { id: 2, offering_id: 1, label: 'Hold closing', proves: 'closing_held', done: 0, sort_order: 2, created_at: iso },
      { id: 3, offering_id: 1, label: 'Something I made up', done: 0, sort_order: 3, created_at: iso },
      { id: 4, offering_id: 1, label: 'A step with its own date', done: 0, due_date: '2026-11-11', sort_order: 4, created_at: iso },
    ],
  })
  const out = await withApp(seed, async page => {
    await tab(page, 'Checklist')
    return page.evaluate(() => [...document.querySelectorAll('.check-item')].map(li => ({
      label: li.querySelector('.check-text').innerText,
      due: [...li.querySelectorAll('.check-due')].map(d => d.innerText).join(' | '),
      implied: !!li.querySelector('.check-due.implied'),
      title: (li.querySelector('.check-due.implied') || {}).title || '',
    })))
  })
  const formD = out.find(x => /Form D/.test(x.label))
  ok(formD.implied && /18 Mar 2026/.test(formD.due),
    `the Form D step carries the date Rule 503 implies (${formD.due})`)
  ok(/first sale/.test(formD.title), 'and says where the date came from')
  const closing = out.find(x => /Hold closing/.test(x.label))
  ok(closing.implied && /30 Sep 2026/.test(closing.due), 'the closing step takes the interim close date')
  const invented = out.find(x => /made up/.test(x.label))
  ok(!invented.implied && invented.due === '', 'a step the record knows nothing about carries no date')
  const typed = out.find(x => /its own date/.test(x.label))
  ok(!typed.implied && /11 Nov 2026/.test(typed.due), 'and a date somebody typed is left exactly as typed')
}

// --- What needs attention --------------------------------------------------
{
  const seed = base({
    offerings: [
      { id: 1, name: 'Overdue Fund', status: 'Open', exemption: 'Reg D 506(b)', bad_actor_checked_date: '2026-01-02', target_min_cents: 100000, final_close_date: '2026-05-01', classes: [], tranches: [], created_at: iso },
      { id: 2, name: 'Finished Fund', status: 'Closed', exemption: 'Reg D 506(b)', classes: [], tranches: [], created_at: iso },
    ],
    investors: [{ id: 1, name: 'A Co', entity_type: 'Entity', created_at: iso }],
    subscriptions: [
      { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-03-03', created_at: iso },
      { id: 2, offering_id: 2, investor_id: 1, amount_committed_cents: 100000, status: 'Closed', sub_signed_date: '2026-01-03', created_at: iso },
    ],
    tasks: [{ id: 1, offering_id: 1, label: 'File Form D with the SEC', proves: 'form_d', done: 0, sort_order: 1, created_at: iso }],
    escrow: [{ id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 100000, txn_date: '2026-03-05', cleared: 0, created_at: iso }],
  })
  const out = await withApp(seed, async page => {
    await page.evaluate(() => { location.hash = '#/' })
    await page.waitForTimeout(700)
    const panel = await page.locator('.attention').innerText()
    const dates = await page.evaluate(() =>
      [...document.querySelectorAll('.attention-item .attention-when')].map(n => n.innerText.split('\n')[0]))
    await page.locator('.attention-item').first().evaluate(n => n.click())
    await page.waitForTimeout(500)
    return { panel, dates, hash: await page.evaluate(() => location.hash) }
  })
  ok(/Needs attention/.test(out.panel), 'the dashboard opens on what is due')
  ok(/File Form D on Overdue Fund/.test(out.panel), 'the Form D deadline is on it')
  ok(/final close deadline/.test(out.panel), 'so is the close deadline')
  ok(/still pending/.test(out.panel), 'and a deposit that has sat too long')
  ok(!/Finished Fund/.test(out.panel), 'a closed offering is not chased about anything')
  ok(/overdue/i.test(out.panel), 'overdue items are counted as overdue')
  const sorted = [...out.dates].map(d => new Date(d).getTime())
  ok(sorted.every((v, i) => i === 0 || v >= sorted[i - 1]), 'and the whole list is in date order')
  ok(/#\/offerings\/1/.test(out.hash), 'clicking an item opens the offering it belongs to')
}

await browser.close()
console.log('page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'))
if (fails.length || errors.length) {
  console.error(`\nWORKFLOW FAILED — ${fails.length} assertion(s), ${errors.length} page error(s)`)
  process.exit(1)
}
console.log('\nWORKFLOW OK')
