#!/usr/bin/env node
/**
 * Muniment smoke test.
 *
 * Optional developer tool. The app itself needs nothing installed — this is
 * only here so a change to Muniment.html can be proved not to have broken it.
 *
 *   NODE_PATH=$(npm root -g) node tools/smoke.mjs
 *   NODE_PATH=$(npm root -g) node tools/smoke.mjs --shots   # also write PNGs
 *
 * It opens the file in headless Chromium at desktop and phone sizes, seeds a
 * realistic offering, walks every route and every tab, and fails on any
 * console error, unhandled rejection, horizontal overflow, or missing figure.
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Playwright is a developer dependency that lives wherever it happens to be
// installed — locally, or globally. ESM ignores NODE_PATH, so resolve it by
// hand rather than making the caller set up a node_modules tree.
const { chromium } = await (async () => {
  const require = createRequire(import.meta.url)
  const roots = [__dirname, join(__dirname, '..')]
  try { roots.push(execSync('npm root -g', { encoding: 'utf8' }).trim()) } catch { /* npm absent */ }
  for (const root of roots) {
    const candidate = join(root, 'node_modules', 'playwright', 'index.js')
    const path = existsSync(candidate) ? candidate : null
    if (path) return require(path)
    try { return require(require.resolve('playwright', { paths: [root] })) } catch { /* keep looking */ }
  }
  console.error('playwright is not installed. Try:  npm i -D playwright')
  process.exit(2)
})()
// MUNIMENT_APP lets the harness point at a work-in-progress copy.
const APP_URL = 'file://' + (process.env.MUNIMENT_APP || join(__dirname, '..', 'Muniment.html'))
const SHOTS = process.argv.includes('--shots')
const SHOT_DIR = join(__dirname, '..', '.smoke-shots')
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'laptop', width: 1180, height: 800, isMobile: false },
  { name: 'tablet', width: 820, height: 1180, isMobile: false },
  { name: 'phone', width: 390, height: 844, isMobile: true },
]

const failures = []
const notes = []
function fail (where, msg) { failures.push(`${where}: ${msg}`) }
function note (msg) { notes.push(msg) }

/** A small but complete data set: two offerings, one of them mid-closing. */
const SEED = (() => {
  const iso = '2026-08-18T09:00:00.000Z'
  const investors = [
    { id: 1, name: 'Jane Q. Public', entity_type: 'Individual', first_name: 'Jane', middle_name: 'Q.', last_name: 'Public', tax_id: '123456789', email: 'jane@example.com', phone: '313-555-0101', address: '1 Main St\nDetroit, MI', accredited_status: 'Verified', accredited_verified_date: '2026-06-01', notes: null, created_at: iso, updated_at: iso },
    { id: 2, name: 'Acme Holdings LLC', entity_type: 'Entity', first_name: null, middle_name: null, last_name: null, tax_id: '987654321', contact_name: 'Dana Reyes', email: 'dana@acme.example', phone: '313-555-0102', address: '2 Second Ave\nAnn Arbor, MI', accredited_status: 'Self-certified', accredited_verified_date: null, notes: null, created_at: iso, updated_at: iso },
    { id: 3, name: 'Robert A. Chen', entity_type: 'Individual', first_name: 'Robert', middle_name: 'A.', last_name: 'Chen', tax_id: '456789123', email: 'rchen@example.com', phone: null, address: null, accredited_status: 'Unknown', accredited_verified_date: null, notes: null, created_at: iso, updated_at: iso },
    { id: 4, name: 'Chen Family Trust', entity_type: 'Trust', first_name: null, middle_name: null, last_name: null, tax_id: '741852963', contact_name: 'Robert A. Chen, Trustee', email: null, phone: null, address: null, accredited_status: 'Verified', accredited_verified_date: '2026-05-14', notes: null, created_at: iso, updated_at: iso },
  ]
  const offerings = [
    {
      id: 1, name: 'Riverfront Partners Fund I', issuer_name: 'Riverfront Partners LLC', exemption: 'Reg D 506(b)',
      security_type: 'LLC Units', status: 'Open', target_min_cents: 100000000, target_max_cents: 500000000,
      price_per_unit_cents: 100000, min_investment_cents: 5000000, launch_date: '2026-03-02',
      first_close_date: '2026-07-15', final_close_date: '2026-11-30', form_d_filed_date: '2026-03-09',
      escrow_agent: 'Great Lakes Escrow Co.', escrow_bank: 'Michigan Commerce Bank', escrow_account_number: '4471002391',
      notes: 'Interim closings permitted after the minimum raise is satisfied.', default_return_rate: 8,
      no_max: 0, fractional_allowed: 1, no_deadline: 0, pass_through_costs: 1, costs_label: 'Legal & professional fees',
      classes: [{ name: 'Common Units', total_percent: 20, sponsor: true }, { name: 'Class A Units', total_percent: 80, sponsor: false }],
      tranches: [{ id: 1, name: 'Tranche 1', price_per_unit_cents: 100000, min_investment_cents: 5000000, target_min_cents: 100000000, target_max_cents: 300000000, security_type: 'LLC Units', class_name: 'Class A Units', default_return_rate: 8, close_date: '2026-07-15', notes: null }],
      created_at: iso, updated_at: iso,
    },
    {
      id: 2, name: 'Cass Corridor Note Program', issuer_name: 'Cass Corridor Development Inc.', exemption: 'Reg D 506(c)',
      security_type: 'Promissory Note', status: 'Drafting', target_min_cents: 25000000, target_max_cents: null,
      price_per_unit_cents: null, min_investment_cents: 2500000, launch_date: null, first_close_date: null,
      final_close_date: null, form_d_filed_date: null, escrow_agent: null, escrow_bank: null,
      escrow_account_number: null, notes: null, default_return_rate: 6.5, no_max: 1, fractional_allowed: 0,
      no_deadline: 1, pass_through_costs: 0, costs_label: null, classes: [], tranches: [],
      created_at: iso, updated_at: iso,
    },
  ]
  const subscriptions = [
    { id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 25000000, units: 250, costs_cents: 150000, tranche_id: 1, funded_date: '2026-06-12', status: 'Funded', sub_sent_date: '2026-05-20', sub_signed_date: '2026-06-01', notes: null, closing_id: null, created_at: iso, updated_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, amount_committed_cents: 50000000, units: 500, costs_cents: 250000, tranche_id: 1, funded_date: '2026-06-20', status: 'Funded', sub_sent_date: '2026-05-20', sub_signed_date: '2026-06-04', notes: null, closing_id: null, created_at: iso, updated_at: iso },
    { id: 3, offering_id: 1, investor_id: 3, amount_committed_cents: 10000000, units: 100, costs_cents: null, tranche_id: 1, funded_date: null, status: 'Sub sent', sub_sent_date: '2026-07-30', sub_signed_date: null, notes: null, closing_id: null, created_at: iso, updated_at: iso },
    { id: 4, offering_id: 1, investor_id: 4, amount_committed_cents: 30000000, units: 300, costs_cents: 180000, tranche_id: 1, funded_date: null, status: 'Sub signed', sub_sent_date: '2026-07-02', sub_signed_date: '2026-07-19', notes: null, closing_id: null, created_at: iso, updated_at: iso },
  ]
  const escrow = [
    { id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 25150000, txn_date: '2026-06-12', method: 'Wire', reference: 'FED2291', cleared: 1, notes: null, created_at: iso },
    { id: 2, offering_id: 1, investor_id: 2, txn_type: 'deposit', amount_cents: 50250000, txn_date: '2026-06-20', method: 'Wire', reference: 'FED2318', cleared: 1, notes: null, created_at: iso },
    { id: 3, offering_id: 1, investor_id: 4, txn_type: 'deposit', amount_cents: 30180000, txn_date: '2026-07-22', method: 'Check', reference: '10441', cleared: 0, notes: null, created_at: iso },
    { id: 4, offering_id: 1, investor_id: null, txn_type: 'fee', amount_cents: 120000, txn_date: '2026-07-01', method: 'ACH', reference: 'Escrow agent fee', cleared: 1, notes: null, created_at: iso },
  ]
  const tasks = ['Engagement letter signed', 'Draft Private Placement Memorandum', 'Draft subscription agreement', 'Prepare accredited-investor questionnaire', 'Set up escrow account with escrow agent', 'Blue sky / state notice filings', 'File Form D with the SEC', 'Distribute offering documents to investors', 'Collect signed subscription agreements', 'Verify accredited-investor status', 'Confirm minimum raise satisfied', 'Hold closing', 'Release escrow funds to issuer', 'Post-closing filings / amendments']
    .map((label, i) => ({ id: i + 1, offering_id: 1, label, done: i < 6 ? 1 : 0, due_date: null, sort_order: i, created_at: iso }))
  const reconciliations = [
    { id: 1, offering_id: 1, statement_date: '2026-07-31', statement_balance_cents: 75280000, difference_cents: 0, notes: 'Agrees to bank.', created_at: iso },
  ]
  return {
    meta: { version: 1, app: 'Muniment' },
    seq: { offerings: 2, investors: 4, subscriptions: 4, escrow: 4, tasks: tasks.length, reconciliations: 1, closings: 0, certificates: 0 },
    offerings, investors, subscriptions, escrow, tasks, reconciliations, closings: [], certificates: [],
  }
})()

const TABS = ['Overview', 'Tranches', 'Investors', 'Escrow', 'Closings', 'Certificates', 'Checklist', 'Reconciliation']

async function walk (page, vp) {
  const where = vp.name
  const shot = async name => {
    if (SHOTS) await page.screenshot({ path: join(SHOT_DIR, `${vp.name}-${name}.png`), fullPage: false })
  }

  const go = async (hash, label) => {
    await page.evaluate(h => { window.location.hash = h }, hash)
    await page.waitForFunction(() => {
      const v = document.getElementById('view')
      return v && v.children.length > 0 && !v.querySelector('.loading')
    }, null, { timeout: 8000 }).catch(() => fail(where, `${label} never finished loading`))
    await page.waitForTimeout(120)
  }

  // Dashboard
  await go('#/', 'dashboard')
  const statCount = await page.locator('.stat-card').count()
  if (statCount < 3) fail(where, `dashboard shows ${statCount} stat cards, expected at least 3`)
  await shot('dashboard')

  // Offerings index
  await go('#/offerings', 'offerings')
  if (await page.locator('.offering-card, .oc-name').count() === 0) fail(where, 'offerings list rendered no offering')
  await shot('offerings')

  // Offering detail, every tab
  for (const tab of TABS) {
    await go(`#/offerings/1?tab=${encodeURIComponent(tab)}`, `offering tab ${tab}`)
    const text = await page.locator('#view').innerText()
    if (!text || text.length < 20) fail(where, `offering tab ${tab} rendered almost nothing`)
    if (/undefined|NaN|\[object Object\]/.test(text)) {
      fail(where, `offering tab ${tab} rendered a broken value (undefined/NaN/[object Object])`)
    }
    await shot(`offering-${tab.toLowerCase()}`)
  }

  // Settings
  await go('#/settings', 'settings')
  const setText = await page.locator('#view').innerText()
  if (!/Defaults for new offerings/i.test(setText)) fail(where, 'settings page did not render its defaults panel')
  if (/undefined|NaN|\[object Object\]/.test(setText)) fail(where, 'settings rendered a broken value')

  // Investors
  await go('#/investors', 'investors')
  if (await page.locator('tbody tr, .rt-card').count() === 0) fail(where, 'investor roster rendered no rows')
  await shot('investors')

  await go('#/investors/1', 'investor detail')
  const invText = await page.locator('#view').innerText()
  if (!invText.includes('Jane')) fail(where, 'investor detail did not render the name')
  await shot('investor-detail')

  // Modal / form, at this width
  await go('#/offerings/1?tab=Investors', 'offering investors')
  const addBtn = page.locator('#view button', { hasText: /^\+?\s*Add investor$/i }).first()
  if (await addBtn.count()) {
    // Dispatch directly: sticky headers can sit over the button at some widths,
    // and this test is about the form, not about hit-testing.
    await addBtn.evaluate(b => b.click())
    await page.waitForSelector('#modal-root .modal', { timeout: 4000 }).catch(() => fail(where, 'subscription form did not open'))
    await page.waitForTimeout(200)
    await shot('form-subscription')
    const overflows = await page.evaluate(() => {
      const m = document.querySelector('#modal-root .modal')
      if (!m) return null
      return { w: m.scrollWidth, client: m.clientWidth, vw: window.innerWidth }
    })
    if (overflows && overflows.w > overflows.client + 2) {
      fail(where, `modal scrolls horizontally (${overflows.w} > ${overflows.client})`)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    if (await page.locator('#modal-root .modal').count()) fail(where, 'Escape did not close the modal')
  }

  // Nothing may spill off the right edge. Checking documentElement alone is not
  // enough — a flex child can be squeezed to zero while its table overflows
  // invisibly, which is exactly how a phone layout goes wrong without the
  // document ever growing.
  for (const tab of ['Certificates', 'Escrow', 'Investors']) {
    await go(`#/offerings/1?tab=${tab}`, `overflow check ${tab}`)
    const overflow = await page.evaluate(() => {
      const win = window.innerWidth
      const spills = []
      for (const n of document.querySelectorAll('#view *')) {
        const cs = getComputedStyle(n)
        if (cs.overflowX !== 'visible' || cs.display === 'none') continue
        // An element spills when its content is wider than the viewport and no
        // ancestor has been given a way to scroll it.
        if (n.scrollWidth > win && n.scrollWidth > n.clientWidth + 4) {
          let scrollable = false
          for (let p = n.parentElement; p; p = p.parentElement) {
            const px = getComputedStyle(p).overflowX
            if (px === 'auto' || px === 'scroll' || px === 'hidden') { scrollable = true; break }
          }
          if (!scrollable) {
            spills.push(`${n.tagName.toLowerCase()}.${(n.className || '').toString().trim().split(/\s+/)[0] || '-'} ${n.scrollWidth}px`)
          }
        }
      }
      return { doc: document.documentElement.scrollWidth, win, spills: spills.slice(0, 4) }
    })
    if (overflow.doc > overflow.win + 2) {
      fail(where, `${tab}: document scrolls horizontally (${overflow.doc} > ${overflow.win})`)
    }
    if (overflow.spills.length) {
      fail(where, `${tab}: content wider than the ${overflow.win}px viewport with nothing to scroll it — ${overflow.spills.join(', ')}`)
    }
  }

  // On a phone the navigation must not eat the screen, and the page must
  // actually fit the device. Chromium widens the layout viewport to swallow
  // overflowing content, so window.innerWidth growing past the device width is
  // itself the symptom — measure against the device width, never against a
  // viewport that has already given up.
  if (vp.isMobile) {
    for (const tab of ['Investors', 'Escrow', 'Certificates']) {
      await go(`#/offerings/1?tab=${tab}`, `phone fit ${tab}`)
      const fit = await page.evaluate(() => {
        const aside = document.querySelector('.sidebar')
        const cs = aside && getComputedStyle(aside)
        const hidden = !aside || cs.display === 'none' || cs.visibility === 'hidden'
        return {
          sidebar: hidden ? 0 : aside.getBoundingClientRect().width,
          layout: window.innerWidth,
        }
      })
      if (fit.layout > vp.width + 1) {
        fail(where, `${tab}: does not fit a ${vp.width}px screen — the layout viewport stretched to ${fit.layout}px`)
      }
      if (fit.sidebar > vp.width * 0.3) {
        fail(where, `${tab}: the sidebar takes ${Math.round(fit.sidebar)}px of a ${vp.width}px screen`)
      }
    }
    await go('#/', 'phone dashboard')
    // Every interactive control needs a real touch target.
    const small = await page.evaluate(() => {
      const bad = []
      for (const n of document.querySelectorAll('#view button, #view a[onclick], #view input[type=checkbox], .bottom-nav button, .bottom-nav a')) {
        const r = n.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        if (r.height < 32) bad.push(`${n.tagName.toLowerCase()}.${(n.className || '').toString().trim().split(/\s+/)[0] || '-'} ${Math.round(r.height)}px`)
      }
      return [...new Set(bad)].slice(0, 5)
    })
    if (small.length) note(`${where}: small touch targets — ${small.join(', ')}`)
  }

  // Dark theme renders without exploding.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await go('#/', 'dashboard (dark)')
  await shot('dashboard-dark')
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  if (bodyBg === 'rgba(0, 0, 0, 0)' || bodyBg === 'transparent') fail(where, 'body has no background in dark mode')
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
}

async function main () {
  const browser = await chromium.launch()
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      deviceScaleFactor: vp.isMobile ? 3 : 1,
    })
    const page = await context.newPage()
    page.on('console', m => {
      if (m.type() === 'error') fail(vp.name, `console error: ${m.text().slice(0, 220)}`)
    })
    page.on('pageerror', e => fail(vp.name, `page error: ${String(e).slice(0, 220)}`))

    await page.addInitScript(seed => {
      try {
        localStorage.setItem('muniment:data', JSON.stringify(seed))
        localStorage.setItem('muniment:theme', 'light')
      } catch (e) { /* ignore */ }
    }, SEED)

    await page.goto(APP_URL, { waitUntil: 'load' })
    await page.waitForTimeout(250)
    await walk(page, vp)
    await context.close()
    note(`${vp.name} (${vp.width}x${vp.height}) walked`)
  }
  await browser.close()

  for (const n of notes) console.log('  ok  ' + n)
  if (failures.length) {
    console.error(`\n  ${failures.length} failure${failures.length === 1 ? '' : 's'}:`)
    for (const f of failures) console.error('  ✗  ' + f)
    process.exit(1)
  }
  console.log(`\n  All viewports clean.${SHOTS ? ' Screenshots in .smoke-shots/' : ''}`)
}

main().catch(e => { console.error(e); process.exit(1) })
