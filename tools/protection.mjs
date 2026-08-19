#!/usr/bin/env node
/**
 * Muniment passphrase-protection test.
 *
 * The one feature in the app that can destroy a file rather than merely
 * mis-state it. Everything here is about the two ways that happens: writing
 * plaintext when the user was told it was sealed, and writing anything at all
 * over a document that has not been opened.
 *
 * Driven entirely through the interface and what lands in storage — the app
 * exposes nothing for tests to hold on to, and should not.
 *
 *   node tools/protection.mjs
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
const PASS = 'correct horse battery staple'
// Deriving the key is deliberately slow — 600k PBKDF2 rounds. Every wait that
// straddles one is this long on purpose.
const KDF_WAIT = 6000

const seed = {
  meta: { version: 3, app: 'Muniment' },
  seq: { offerings: 9, investors: 9, subscriptions: 9, escrow: 9, tasks: 9, reconciliations: 9, closings: 9, certificates: 9, parties: 0, activity: 0 },
  offerings: [{ id: 1, name: 'Sealed Holdings', status: 'Open', target_min_cents: 5000000, classes: [], tranches: [], created_at: iso }],
  // A taxpayer number is the thing this feature exists for; the assertions
  // below look for it by value in whatever the app actually wrote.
  investors: [{ id: 1, name: 'Ledger Trust', entity_type: 'Trust', tax_id: '123456789', accredited_status: 'Verified', created_at: iso }],
  subscriptions: [], escrow: [], tasks: [], reconciliations: [], closings: [], certificates: [],
  parties: [], activity: [], distributions: [], transfers: [], capital_calls: [], state_filings: [],
  settings: {}, dismissed: {},
}

const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
// Seeded once and only once. An init script would re-run on every navigation
// and put the plaintext seed back, quietly undoing the encryption this suite
// exists to check — the reload below is the whole point of the exercise.
await page.goto(APP, { waitUntil: 'load' })
await page.evaluate(s => { localStorage.setItem('muniment:data', JSON.stringify(s)) }, seed)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(500)

const raw = () => page.evaluate(() => localStorage.getItem('muniment:data'))
const settled = async () => { await page.waitForTimeout(400) }

// --- Before: the file says the quiet part out loud -------------------------
{
  const text = await raw()
  ok(text.includes('123456789'), 'unprotected, the taxpayer number is in the file in the clear')
}

// --- Setting a passphrase seals what is written ----------------------------
await page.evaluate(() => { location.hash = '#/settings' })
await settled()
await page.locator('#view button', { hasText: 'Set a passphrase…' }).first().evaluate(b => b.click())
await settled()
{
  const boxes = page.locator('.modal input[type=password]')
  ok(await boxes.count() === 2, 'the passphrase is asked for twice')
  await boxes.nth(0).fill(PASS)
  await boxes.nth(1).fill('something else')
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await settled()
  ok((await page.locator('.modal .form-error').innerText()).includes('do not match'),
    'two different passphrases are refused')

  await boxes.nth(0).fill('short')
  await boxes.nth(1).fill('short')
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(KDF_WAIT)
  ok((await page.locator('.modal .form-error').innerText()).toLowerCase().includes('eight characters'),
    'a passphrase too short to be worth having is refused')

  await boxes.nth(0).fill(PASS)
  await boxes.nth(1).fill(PASS)
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(KDF_WAIT)
}
{
  const text = await raw()
  const env = JSON.parse(text)
  ok(env.format === 'muniment-encrypted', 'what is written is now an envelope')
  ok(!text.includes('123456789'), 'and the taxpayer number is nowhere in it')
  ok(!text.includes('Ledger Trust'), 'nor is the holder name')
  ok(!text.includes('Sealed Holdings'), 'nor the name of the offering')
  ok(env.kdf && env.kdf.name === 'PBKDF2' && env.kdf.iterations >= 600000,
    `the envelope records its derivation (${env.kdf && env.kdf.iterations} rounds)`)
  ok(typeof env.iv === 'string' && env.iv.length > 0, 'and carries an initialisation vector')
  ok(typeof env.kdf.salt === 'string' && env.kdf.salt.length > 0, 'and the salt it derived with')
}

// --- A change written while protected stays protected ----------------------
// Through the interface, so this exercises the same write path a real edit does.
await page.locator('#view button', { hasText: 'Edit' }).first().evaluate(b => b.click())
await settled()
await page.locator('.modal input[name=firm_name]').fill('Bellweather & Rooke LLP')
await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
await page.waitForTimeout(1200)
{
  const text = await raw()
  ok(!text.includes('Bellweather'), 'an edit made after protection is sealed too')
  ok(JSON.parse(text).format === 'muniment-encrypted', 'and is still an envelope')
}

// --- Reloading finds a locked document -------------------------------------
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(900)
const sealedBefore = await raw()
{
  ok((await page.locator('#view').innerText()).includes('This data is protected'),
    'a locked document shows as locked rather than as empty')
  ok(await page.locator('.modal').count() === 1, 'and asks for the passphrase straight away')
}

// --- Nothing is written over a document that was never opened --------------
{
  await page.locator('.modal button', { hasText: 'Cancel' }).first().evaluate(b => b.click())
  await settled()
  // Move around the app, which is what a person who dismissed the box would
  // do. Every route must refuse to draw, and none of it may reach storage.
  for (const h of ['#/offerings', '#/investors', '#/settings', '#/']) {
    await page.evaluate(hash => { location.hash = hash }, h)
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(600)
  ok(await raw() === sealedBefore, 'walking the app while locked writes nothing over the sealed document')
  ok((await page.locator('#view').innerText()).includes('This data is protected'),
    'and every route still shows the locked screen')
}

// --- The wrong passphrase is refused; the right one opens it ---------------
await page.locator('#view button', { hasText: 'Unlock…' }).first().evaluate(b => b.click())
await settled()
{
  await page.locator('.modal input[type=password]').fill('not the passphrase')
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(KDF_WAIT)
  ok((await page.locator('.modal .form-error').innerText()).includes('does not open'),
    'a wrong passphrase is refused rather than yielding plausible rubbish')
  ok(await raw() === sealedBefore, 'and a failed attempt writes nothing either')

  await page.locator('.modal input[type=password]').fill(PASS)
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(KDF_WAIT)
  ok(await page.locator('.modal').count() === 0, 'the right passphrase closes the dialog')
  ok(!(await page.locator('#view').innerText()).includes('This data is protected'),
    'and the app is usable again')
}
{
  await page.evaluate(() => { location.hash = '#/investors' })
  await page.waitForTimeout(500)
  const view = await page.locator('#view').innerText()
  ok(view.includes('Ledger Trust'), 'the records survived the round trip')
  await page.evaluate(() => { location.hash = '#/settings' })
  await page.waitForTimeout(500)
  ok((await page.locator('#view').innerText()).includes('Bellweather'),
    'including the edit made while protected')
  ok(JSON.parse(await raw()).format === 'muniment-encrypted', 'and what is on disk is still sealed')
}

// --- Changing the passphrase needs the current one -------------------------
await page.locator('#view button', { hasText: 'Change…' }).first().evaluate(b => b.click())
await settled()
{
  const boxes = page.locator('.modal input[type=password]')
  ok(await boxes.count() === 3, 'changing it asks for the current passphrase as well')
  await boxes.nth(0).fill('the wrong current one')
  await boxes.nth(1).fill('a whole new passphrase')
  await boxes.nth(2).fill('a whole new passphrase')
  await page.locator('.modal button[type=submit]').first().evaluate(b => b.click())
  await page.waitForTimeout(KDF_WAIT)
  ok((await page.locator('.modal .form-error').innerText()).includes('not the current passphrase'),
    'and refuses a wrong one')
  await page.locator('.modal button', { hasText: 'Cancel' }).first().evaluate(b => b.click())
  await settled()
}

// --- Removing protection writes plaintext again, and says so ---------------
await page.locator('#view button', { hasText: 'Remove protection' }).first().evaluate(b => b.click())
await settled()
{
  const body = await page.locator('.modal').innerText()
  ok(/plain, readable JSON/i.test(body), 'removing protection says what the file becomes')
  await page.locator('.modal button', { hasText: 'Remove protection' }).last().evaluate(b => b.click())
  await page.waitForTimeout(1200)
  const text = await raw()
  ok(text.includes('123456789'), 'and the file goes back to plain JSON')
  ok(text.includes('Bellweather'), 'with everything still in it')
}

await ctx.close()
await browser.close()
console.log('page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'))
if (fails.length || errors.length) {
  console.error(`\nPROTECTION FAILED — ${fails.length} assertion(s), ${errors.length} page error(s)`)
  process.exit(1)
}
console.log('\nPROTECTION OK')
