#!/usr/bin/env node
/**
 * Muniment unit tests.
 *
 * The five browser suites are end-to-end and slow. The functions where a
 * money bug would actually live — the accrual, the percentage settlement, the
 * cent allocation, the numbering, the exemption arithmetic — are pure given a
 * document, and were tested only through a browser, if at all.
 *
 * This loads src/app/*.js into a VM with a stub for the handful of browser
 * globals the top-level code touches, and then calls those functions
 * directly. No browser, no DOM, no fixtures beyond a plain object.
 *
 * 24-boot.js is deliberately excluded: it is the only file with a side effect
 * at load, which is what makes the rest loadable this way.
 *
 *   node tools/units.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPDIR = join(ROOT, 'src', 'app')

const fails = []
const ok = (c, label) => { console.log((c ? '  ok   ' : '  FAIL ') + label); if (!c) fails.push(label) }
const eq = (got, want, label) =>
  ok(Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want),
    `${label}${Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want) ? '' : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`)

/* ---- The stub -------------------------------------------------------------
   Only what the top level of the source actually reaches for while loading:
   a theme read, a couple of event listeners, and the feature checks that
   decide which file-saving story to tell. Nothing here is a DOM: a test that
   needed one would be an end-to-end test, and belongs in the other suites. */
function makeContext () {
  const noop = () => {}
  const store = new Map()
  const stubEl = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, setAttribute: noop, removeAttribute: noop,
    addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
    firstChild: null, textContent: '', innerHTML: '', focus: noop, remove: noop,
  })
  const ctx = {
    console,
    Intl, Math, JSON, Date, Number, String, Boolean, Array, Object, Map, Set, RegExp, Error, Promise,
    isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: noop,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    TextEncoder, TextDecoder, Blob: class {}, URL,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    indexedDB: { open: () => ({}) },
    crypto: globalThis.crypto,
    navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
    location: { hash: '', href: 'file:///Muniment.html' },
    history: { replaceState: noop },
    addEventListener: noop,
    document: {
      documentElement: stubEl(),
      body: stubEl(),
      createElement: stubEl,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: noop,
      visibilityState: 'visible',
    },
  }
  ctx.window = ctx
  ctx.globalThis = ctx
  vm.createContext(ctx)
  return ctx
}

const ctx = makeContext()
for (const f of readdirSync(APPDIR).sort()) {
  // The entry point is the one file that does something on load.
  if (f === '24-boot.js') continue
  vm.runInContext(readFileSync(join(APPDIR, f), 'utf8'), ctx, { filename: f })
}
// Reach into the loaded scope by name.
const g = name => vm.runInContext(name, ctx)
const call = (name, ...args) => vm.runInContext(`(${name})`, ctx)(...args)
// Replace the document the app holds in memory, so a test can state a whole
// world in one object literal.
const setDb = doc => { ctx.__fixture = doc; vm.runInContext('db = __fixture', ctx) }

const iso = '2026-01-01T00:00:00.000Z'
const emptyDoc = extra => {
  ctx.__empty = extra || {}
  return vm.runInContext('Object.assign(normalize({}), __empty)', ctx)
}

console.log('\n  Money in and out of strings')
{
  eq(call('dollarsToCents', '1,234.56'), 123456, 'commas and a decimal read as cents')
  eq(call('dollarsToCents', '$1,000'), 100000, 'a currency symbol is ignored')
  // The comment in the source is the specification: 1.005 is 101 cents at the
  // hand, and 100.49999999999999 in binary floating point.
  eq(call('dollarsToCents', '1.005'), 101, 'the third decimal rounds half up, from the digits not the float')
  eq(call('dollarsToCents', '0.005'), 1, 'and does so at zero too')
  eq(call('dollarsToCents', '−50.00'), -5000, 'a real minus sign is a negative')
  eq(call('dollarsToCents', ''), null, 'an empty string is not zero')
  eq(call('dollarsToCents', null), null, 'and neither is nothing')
  eq(call('money', 0), '$0.00', 'zero prints as zero, never as a dash')
  eq(call('money', null), '—', 'and a dash means there is no figure')
  ok(call('money', -1234).includes('−'), 'a negative uses a real minus sign, per the brand rules')
}

console.log('\n  Accrual')
{
  const accrue = (...a) => call('accrue', ...a)
  // $100,000 at 8% for exactly a year.
  eq(accrue(10000000, 8, '2026-01-01', '2027-01-01', 'simple/365'), 800000,
    'simple interest over a 365-day year')
  eq(accrue(10000000, 8, '2026-01-01', '2026-07-01', 'simple/365'),
    Math.round(10000000 * 0.08 * (181 / 365)), 'and part of one, by actual days')
  eq(accrue(10000000, 8, '2026-01-01', '2027-01-01', 'simple/360'), 800000,
    '30/360 over a full year comes to the same')
  // 30/360 counts every month as 30 days: Jan 31 to Feb 28 is 28, not 27.
  eq(call('days30360', '2026-01-31', '2026-02-28'), 28, 'a 30/360 month is thirty days regardless')
  // US bond basis: D2 is only pulled back to 30 when D1 is already 30 or 31.
  // 1 Jan to 31 Dec therefore counts 360, not 359.
  eq(call('days30360', '2026-01-01', '2026-12-31'), 360, 'and 1 January to 31 December counts 360')
  eq(call('days30360', '2026-01-31', '2026-03-31'), 60, 'two whole 30/360 months are sixty days')
  eq(call('days30360', '2026-06-01', '2026-01-01'), 0, 'a backwards range counts nothing')
  eq(accrue(10000000, 8, '2026-01-01', '2027-01-01', 'annual/365'), 800000,
    'compounded annually, one year is one period')
  ok(accrue(10000000, 8, '2026-01-01', '2028-01-01', 'annual/365') > 1600000,
    'over two years compounding beats simple interest')
  eq(accrue(10000000, 8, '2026-01-01', '2028-01-01', 'annual/365'), 1664000,
    'by exactly the compounded amount')
  ok(accrue(10000000, 8, '2026-01-01', '2027-01-01', 'quarterly/365') > 800000,
    'and quarterly compounding beats annual over the same year')
  eq(accrue(10000000, 8, '2026-06-01', '2026-01-01', 'simple/365'), 0,
    'an as-of date before the start accrues nothing rather than going negative')
  eq(accrue(null, 8, '2026-01-01', '2027-01-01', 'simple/365'), null, 'no capital, no figure')
  eq(accrue(10000000, null, '2026-01-01', '2027-01-01', 'simple/365'), null, 'no rate, no figure')
  eq(accrue(10000000, 8, null, '2027-01-01', 'simple/365'), null, 'no start, no figure')
  eq(accrue(10000000, 8, '2026-01-01', '2027-01-01', 'nonsense'), 800000,
    'an unknown convention falls back to the one every old certificate was written under')
}

console.log('\n  Allocating cents')
{
  const alloc = (...a) => call('allocateCents', ...a)
  eq(alloc(1000001, [50, 30, 20]).reduce((a, b) => a + b, 0), 1000001,
    'an amount that does not divide still comes to the whole')
  eq(alloc(100, [1, 1, 1]), [34, 33, 33], 'the odd cents go to the largest remainders, in order')
  eq(alloc(10, [0, 0, 0]), [0, 0, 0], 'weights that are all zero allocate nothing')
  eq(alloc(0, [1, 2, 3]), [0, 0, 0], 'and nothing to allocate allocates nothing')
  eq(alloc(1, [1, 1]), [1, 0], 'a single cent goes somewhere rather than nowhere')
  for (const n of [7, 13, 99, 101]) {
    const w = Array.from({ length: n }, (_, i) => i + 1)
    const total = 1234567
    ok(alloc(total, w).reduce((a, b) => a + b, 0) === total,
      `${n} unequal weights still total exactly (${total})`)
  }
}

console.log('\n  Percentage columns that add up')
{
  const settle = rows => { call('settlePercentages', rows, 'x', 'shown', 100); return rows.map(r => r.shown) }
  // The guarantee is in ten-thousandths, which is the unit the algorithm works
  // in and the precision the column is displayed to. Re-summing the decimals
  // as floats reintroduces an error of about 1e-14 that no reader ever sees —
  // asserting on that would be testing IEEE 754, not the allocation.
  const totalsExactly = vals => vals.reduce((a, v) => a + Math.round(v * 1e4), 0) === 1e6
  const thirds = [{ x: 100 / 3 }, { x: 100 / 3 }, { x: 100 / 3 }]
  const out = settle(thirds)
  ok(totalsExactly(out), 'three equal thirds total exactly 100')
  ok(out.every(v => Math.abs(v - 100 / 3) < 0.0001), 'and every figure is within a ten-thousandth of its share')
  const sevenths = Array.from({ length: 7 }, () => ({ x: 100 / 7 }))
  ok(totalsExactly(settle(sevenths)), 'sevenths too')
  for (const n of [3, 7, 11, 23, 97]) {
    const rows = Array.from({ length: n }, () => ({ x: 100 / n }))
    ok(totalsExactly(settle(rows)), `and ${n} equal shares`)
  }
  // What a reader actually checks: the column, as printed, adds to 100.
  const printed = settle(Array.from({ length: 7 }, () => ({ x: 100 / 7 })))
    .reduce((a, v) => a + Number(call('fmtPct', v).replace('%', '')), 0)
  eq(Math.round(printed * 1e4) / 1e4, 100, 'and the figures as printed add to 100 too')
  // A column that is not trying to be 100 is left alone: a class that
  // genuinely holds 60% must not be inflated.
  const sixty = [{ x: 30 }, { x: 30 }]
  eq(settle(sixty), [30, 30], 'a column that sums to something else is left exactly as it is')
  const withBlank = [{ x: 50 }, { x: null }, { x: 50 }]
  eq(settle(withBlank), [50, null, 50], 'a row with no figure stays without one')
}

console.log('\n  Certificate numbering')
{
  setDb(emptyDoc({
    offerings: [
      { id: 1, name: 'Plain', cert_number_format: { prefix: '', pad: 1 }, classes: [], tranches: [] },
      { id: 2, name: 'Prefixed', cert_number_format: { prefix: 'A-', pad: 1 }, classes: [], tranches: [] },
      { id: 3, name: 'Padded', cert_number_format: { prefix: '', pad: 3 }, classes: [], tranches: [] },
    ],
    certificates: [
      { id: 1, offering_id: 1, cert_number: '1' }, { id: 2, offering_id: 1, cert_number: '2' },
      { id: 3, offering_id: 2, cert_number: 'A-1' }, { id: 4, offering_id: 2, cert_number: 'A-12' },
      { id: 5, offering_id: 3, cert_number: '007' },
      // A stray that does not fit the format must not push the next number.
      { id: 6, offering_id: 1, cert_number: '2026-001' },
    ],
  }))
  eq(call('nextCertNumber', 1), '3', 'plain sequential numbering continues')
  eq(call('nextCertNumber', 2), 'A-13', 'a prefixed roster continues under its own prefix')
  eq(call('nextCertNumber', 3), '008', 'and a padded one keeps its width')
  eq(call('highestCertNumber', 1), 2, 'a number that does not fit the format is ignored, not coerced')
  eq(call('formatCertNumber', { cert_number_format: { prefix: 'B-', pad: 4 } }, 9), 'B-0009',
    'the format is applied the same way wherever it is read')
}

console.log('\n  The escrow balance')
{
  setDb(emptyDoc({
    offerings: [{ id: 1, name: 'E', classes: [], tranches: [] }],
    escrow: [
      { id: 1, offering_id: 1, txn_type: 'deposit', amount_cents: 1000000, cleared: 1 },
      { id: 2, offering_id: 1, txn_type: 'deposit', amount_cents: 500000, cleared: 0 },
      { id: 3, offering_id: 1, txn_type: 'refund', amount_cents: 200000, cleared: 1 },
      { id: 4, offering_id: 1, txn_type: 'fee', amount_cents: 50000, cleared: 1 },
      // A row with no amount used to turn every balance on every screen to NaN.
      { id: 5, offering_id: 1, txn_type: 'deposit', amount_cents: null, cleared: 1 },
      // A type that is not a type must not be counted as one.
      { id: 6, offering_id: 1, txn_type: 'constructor', amount_cents: 999999, cleared: 1 },
    ],
  }))
  const s = call('escrowSummary', 1)
  eq(s.clearedBalance, 1000000 - 200000 - 50000, 'the cleared balance nets refunds and fees off deposits')
  eq(s.bookBalance, 1500000 - 200000 - 50000, 'the book balance includes what has not cleared')
  eq(s.clearedNetDeposits, 800000, 'the minimum raise is measured net of refunds')
  ok(Number.isFinite(s.clearedBalance), 'a null amount does not turn the balance into NaN')
}

console.log('\n  What the subscription says about itself')
{
  setDb(emptyDoc({
    offerings: [{ id: 1, name: 'S', price_per_unit_cents: 100000, classes: [], tranches: [] }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 550000, status: 'Prospect' }],
  }))
  const scope = call('scopeFor', { offering: g('db').offerings[0], subscription: g('db').subscriptions[0] })
  eq(call('derivedUnits', g('db').subscriptions[0], scope), null,
    'an amount that does not divide by the price asserts no unit count')
  g('db').subscriptions[0].amount_committed_cents = 500000
  eq(call('derivedUnits', g('db').subscriptions[0], scope), 5, 'one that does, does')
  g('db').offerings[0].fractional_allowed = 1
  g('db').subscriptions[0].amount_committed_cents = 550000
  eq(call('derivedUnits', g('db').subscriptions[0], call('scopeFor', { offering: g('db').offerings[0], subscription: g('db').subscriptions[0] })), 5.5,
    'unless the offering allows fractions')

  const st = s => call('derivedSubStatus', s)
  eq(st({ status: 'Prospect' }), 'Prospect', 'nothing recorded is a prospect')
  eq(st({ sub_sent_date: '2026-01-01' }), 'Sub sent', 'a sent date moves it on')
  eq(st({ sub_sent_date: '2026-01-01', sub_signed_date: '2026-01-02' }), 'Sub signed', 'and a signed one further')
  eq(st({ funded_date: '2026-01-03' }), 'Funded', 'money makes it funded')
  eq(st({ funded_date: '2026-01-03', closing_id: 1 }), 'Closed', 'a closing closes it')
  eq(st({ funded_date: '2026-01-03', status: 'Withdrawn' }), 'Withdrawn',
    'and withdrawn is the one a person chooses, so it wins')
  eq(call('effectiveSubStatus', { status: 'Prospect', funded_date: '2026-01-03' }), 'Funded',
    'a stale label never understates what the dates prove')
  eq(call('effectiveSubStatus', { status: 'Funded', sub_sent_date: '2026-01-01' }), 'Funded',
    'and never overstates it either')
}

console.log('\n  Where the exemption stands')
{
  setDb(emptyDoc({
    offerings: [{ id: 1, name: 'F', exemption: 'Reg D 506(b)', status: 'Open', classes: [], tranches: [] }],
    investors: [{ id: 1, name: 'A', entity_type: 'Entity' }],
    subscriptions: [{ id: 1, offering_id: 1, investor_id: 1, amount_committed_cents: 100000, status: 'Sub signed', sub_signed_date: '2026-03-03' }],
    escrow: [{ id: 1, offering_id: 1, investor_id: 1, txn_type: 'deposit', amount_cents: 100000, txn_date: '2026-03-10', cleared: 1 }],
  }))
  const fd = call('formDPosition', g('db').offerings[0])
  eq(fd.firstSale, '2026-03-03', 'the first sale is the earliest signed subscription')
  eq(fd.due, '2026-03-18', 'and the Form D falls due fifteen days later')
  eq(call('addDays', '2026-02-20', 15), '2026-03-07', 'the fifteen days cross a month end correctly')
  eq(call('addDays', '2028-02-20', 15), '2028-03-06', 'and a leap year')
  eq(call('addYears', '2026-03-18', 1), '2027-03-18', 'the amendment falls a year on')

  // With nothing signed, the cleared deposit fixes it instead.
  g('db').subscriptions[0].sub_signed_date = null
  eq(call('formDPosition', g('db').offerings[0]).firstSale, '2026-03-10',
    'with nothing signed, the earliest cleared deposit fixes the date')
  // A pending deposit is not a sale.
  g('db').escrow[0].cleared = 0
  eq(call('formDPosition', g('db').offerings[0]).firstSale, null,
    'and a deposit that has not cleared fixes nothing')

  g('db').offerings[0].exemption = 'Reg S'
  eq(call('formDPosition', g('db').offerings[0]), null, 'an exemption with no Form D has no position')
}

console.log('\n  Reading a state off an address')
{
  const st = a => call('investorState', a)
  eq(st({ state: 'mi' }), 'MI', 'the field wins, and is normalised')
  eq(st({ address: '10 Chancery Row, Ann Arbor, MI 48104' }), 'MI', 'a trailing ZIP does not hide the state')
  eq(st({ address: '44 Elm Street, Columbus, OH' }), 'OH', 'nor does its absence')
  eq(st({ address: '1 High Street, London' }), null, 'somewhere with no state has none')
  eq(st({ address: '5 Ontario Road, Toronto, ON M5V' }), null, 'and a province is not a state')
  eq(st({ state: 'ZZ', address: '9 Main, Detroit, MI' }), 'MI',
    'a field that is not a state falls back to the address')
}

console.log('\n  Guessing what a pasted name is')
{
  eq(call('guessEntityType', 'Acme Holdings LLC'), 'Entity', 'a name ending LLC is an entity')
  eq(call('guessEntityType', 'Rooke Family Trust'), 'Trust', 'a trust announces itself')
  eq(call('guessEntityType', 'Jane Q Public'), 'Individual', 'and a personal name is a person')
  eq(call('guessEntityType', 'Roth IRA fbo Jane Public'), 'IRA / Retirement', 'as does a retirement account')
  eq(call('splitPersonName', 'Jane Q Public'), { first_name: 'Jane', last_name: 'Public', middle_name: 'Q' },
    'a three-part name splits into three')
  eq(call('splitPersonName', 'Jane Public'), { first_name: 'Jane', last_name: 'Public', middle_name: null },
    'a two-part name has no middle')
  eq(call('splitPersonName', 'Cher'), { first_name: 'Cher', middle_name: null, last_name: null },
    'and one part is a first name, without being clever about it')
}

console.log('\n  Reading a pasted line')
{
  const read = l => call('readContactLine', l)
  const jane = read('Jane Q Public, jane@example.test, MI')
  eq(jane.email, 'jane@example.test', 'an email is recognised by its shape')
  eq(jane.state, 'MI', 'a two-letter state by its')
  eq(jane.body.last_name, 'Public', 'and whatever is left is the name')
  const acme = read('Acme Holdings LLC; 38-1234567; contact@acme.test')
  eq(acme.tax_id, '38-1234567', 'an EIN is picked out wherever it sits')
  eq(acme.body.name, 'Acme Holdings LLC', 'and the entity name survives it')
  const tabbed = read('Rooke Family Trust\tOH')
  eq(tabbed.body.entity_type, 'Trust', 'tabs separate as well as commas')
  eq(read(''), null, 'an empty line is nothing')
  eq(read('   '), null, 'and so is a blank one')
  const phoned = read('Middle Co, (313) 555-0100, OH')
  eq(phoned.phone, '(313) 555-0100', 'a telephone number is recognised too')
  eq(phoned.body.name, 'Middle Co', 'without swallowing the name')
}

console.log('\n  The cap table')
{
  setDb(emptyDoc({
    offerings: [{
      id: 1, name: 'C', classes: [
        { name: 'Sponsor', total_percent: 20, sponsor: true },
        { name: 'Class A', total_percent: 80 },
      ], tranches: [],
    }],
    investors: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }, { id: 3, name: 'Sponsor Co' }],
    certificates: [
      { id: 1, offering_id: 1, investor_id: 1, cert_number: '1', class_name: 'Class A', capital_cents: 7500000, sort_index: 1, no_capital: 0 },
      { id: 2, offering_id: 1, investor_id: 2, cert_number: '2', class_name: 'Class A', capital_cents: 2500000, sort_index: 2, no_capital: 0 },
      { id: 3, offering_id: 1, investor_id: 3, cert_number: '3', class_name: 'Sponsor', capital_cents: null, sort_index: 3, no_capital: 1 },
    ],
  }))
  const r = call('computeCertificates', 1, '2026-06-30')
  const byNum = n => r.certificates.find(c => c.cert_number === n)
  eq(byNum('1').pct_of_class_shown, 75, 'a holder takes their share of their class by capital')
  eq(byNum('1').total_pct_shown, 60, 'and that share of what the class holds of the company')
  eq(byNum('3').pct_of_class_shown, 100, 'a sponsor class with no capital divides evenly')
  eq(byNum('3').total_pct_shown, 20, 'and takes the share the class was given')
  eq(r.certificates.reduce((a, c) => a + c.total_pct_shown, 0), 100, 'the whole column totals exactly 100')

  // A certificate cancelled before the as-of date is history; after it, it was
  // still live on the day being asked about.
  g('db').certificates[0].cancelled_date = '2026-05-01'
  eq(call('computeCertificates', 1, '2026-06-30').certificates.length, 2,
    'a certificate cancelled before the as-of date is off the roster')
  eq(call('computeCertificates', 1, '2026-04-30').certificates.length, 3,
    'and on it, as at a date before the cancellation')
}

console.log('\n  What a distribution has retired')
{
  setDb(emptyDoc({
    offerings: [{ id: 1, name: 'D', classes: [], tranches: [] }],
    investors: [{ id: 1, name: 'One' }],
    certificates: [{ id: 1, offering_id: 1, investor_id: 1, cert_number: '1', class_name: 'A', capital_cents: 10000000, pref_return_rate: 8, accrual_convention: 'simple/365', accrual_start: '2026-01-01', sort_index: 1, no_capital: 0 }],
    distributions: [
      { id: 1, offering_id: 1, label: 'Q1', pay_date: '2026-04-01', amount_cents: 100000, allocations: [{ certificate_id: 1, investor_id: 1, pref_cents: 100000, capital_cents: 0 }] },
      { id: 2, offering_id: 1, label: 'Q3', pay_date: '2026-10-01', amount_cents: 200000, allocations: [{ certificate_id: 1, investor_id: 1, pref_cents: 150000, capital_cents: 50000 }] },
    ],
  }))
  eq(call('distributedTo', 1, '2026-06-30'), { pref: 100000, capital: 0 },
    'only what had been paid by the as-of date counts')
  eq(call('distributedTo', 1, '2026-12-31'), { pref: 250000, capital: 50000 },
    'and by a later one, both')
  const c = call('computeCertificates', 1, '2026-12-31').certificates[0]
  eq(c.accrued_calc - c.pref_paid_cents, c.accrued_outstanding,
    'what is outstanding is what accrued less what was paid against it')
  // An over-payment is a return of capital, not a negative balance.
  g('db').distributions[1].allocations[0].pref_cents = 99000000
  eq(call('computeCertificates', 1, '2026-12-31').certificates[0].accrued_outstanding, 0,
    'and never goes below zero')
}

console.log('\n  Migrating a document written by an older version')
{
  ctx.__old = {
    meta: { version: 2, app: 'CapitalVault' },
    offerings: [{ id: 1, name: 'Old', classes: [], tranches: [] }],
    certificates: [
      { id: 1, offering_id: 1, cert_number: 'A-001' },
      { id: 2, offering_id: 1, cert_number: 'A-002' },
      { id: 3, offering_id: 1, cert_number: 'A-010' },
    ],
  }
  const out = vm.runInContext('normalize(__old)', ctx)
  eq(out.meta.version, g('SCHEMA_VERSION'), 'the document is brought up to the current version')
  eq(out.certificates.every(c => c.accrual_convention === 'simple/365'), true,
    'every existing certificate keeps the convention it was computed under')
  eq(out.offerings[0].cert_number_format, { prefix: 'A-', pad: 3 },
    'and the offering learns the numbering its roster was already using')
  eq(Array.isArray(out.distributions) && Array.isArray(out.state_filings), true,
    'collections added since are present and empty')
  eq(out.seq.certificates >= 3, true, 'the id counters are ahead of the ids in the file')

  // Running it twice must not change anything the first pass settled.
  ctx.__once = out
  const twice = vm.runInContext('normalize(__once)', ctx)
  eq(twice.offerings[0].cert_number_format, { prefix: 'A-', pad: 3 }, 'migrating twice is migrating once')
}

console.log('\n  A CSV cell')
{
  eq(call('csvCell', 'plain'), 'plain', 'ordinary text goes as it is')
  eq(call('csvCell', 'a,b'), '"a,b"', 'a comma is quoted')
  eq(call('csvCell', 'say "hi"'), '"say ""hi"""', 'and a quote is doubled inside quotes')
  eq(call('csvCell', '=1+1'), "'=1+1", 'a formula is neutralised')
  eq(call('csvCell', '+1'), "'+1", 'as is anything else a spreadsheet would evaluate')
  eq(call('csvCell', '@SUM(A1)'), "'@SUM(A1)", 'including an at sign')
  eq(call('csvCell', null), '', 'and nothing is an empty cell, not the word null')
}

console.log('')
if (fails.length) {
  console.error(`UNITS FAILED — ${fails.length} assertion(s)`)
  process.exit(1)
}
console.log('UNITS OK')
