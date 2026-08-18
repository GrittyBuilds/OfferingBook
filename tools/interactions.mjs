#!/usr/bin/env node
/**
 * Muniment interaction test.
 *
 * Where smoke.mjs proves every screen renders, this proves the automation
 * actually automates: suggestions write what they promise, dismissals stick,
 * the palette navigates, the typeahead creates contacts, and the closing form
 * cannot propose money that is not in escrow.
 *
 *   node tools/interactions.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g',{encoding:'utf8'}).trim() + '/playwright/index.js')
const src = readFileSync('/home/user/OfferingBook/tools/smoke.mjs','utf8')
const seed = new Function(src.match(/const SEED = \(\(\) => \{([\s\S]*?)\n\}\)\(\)/)[1])()
const fails = []
const ok = (cond, label) => { console.log((cond?'  ok   ':'  FAIL ')+label); if(!cond) fails.push(label) }

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1380, height: 900 } })).newPage()
const errors = []
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => { if (m.type()==='error') errors.push(m.text()) })
await p.addInitScript(s => { localStorage.setItem('muniment:data', JSON.stringify(s)) }, seed)
await p.goto('file:///home/user/OfferingBook/Muniment.html')
await p.waitForTimeout(500)

// --- 1. Accept the Form D checklist suggestion from the dashboard ----------
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')).tasks.find(t => t.label.includes('Form D')).done)
ok(before === 0, 'Form D step starts unticked')
const card = p.locator('.suggest-card', { hasText: 'File Form D' })
ok(await card.count() === 1, 'the Form D suggestion is on the dashboard')
await card.locator('button', { hasText: 'Accept' }).click()
await p.waitForTimeout(600)
const after = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('muniment:data'))
  return { done: d.tasks.find(t => t.label.includes('Form D')).done,
    activity: d.activity.length, lastAct: d.activity[d.activity.length-1] }
})
ok(after.done === 1, 'accepting ticked the step')
ok(after.activity >= 1 && after.lastAct.kind === 'accepted', 'the acceptance is on the activity trail')
ok(await p.locator('.suggest-card', { hasText: 'File Form D' }).count() === 0, 'the accepted card left the strip')

// --- 2. Dismissals stick --------------------------------------------------
const dismissCard = p.locator('.suggest-card', { hasText: 'firm details' })
if (await dismissCard.count()) {
  await dismissCard.locator('button[aria-label="Dismiss this suggestion"]').click()
  await p.waitForTimeout(500)
  // The dismissal must be in the saved document (a  reload would be wiped by
  // this harness's own addInitScript reseeding, so check storage directly and
  // then re-render through the router).
  const stored = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('muniment:data')).dismissed||{}))
  ok(stored.some(k => k === 'settings-firm'), 'the dismissal is persisted in the document')
  await p.evaluate(() => { location.hash = '#/offerings'; })
  await p.waitForTimeout(300)
  await p.evaluate(() => { location.hash = '#/'; })
  await p.waitForTimeout(400)
  ok(await p.locator('.suggest-card', { hasText: 'firm details' }).count() === 0, 'a dismissal stays dismissed across renders')
} else ok(false, 'firm-details suggestion present to dismiss')

// --- 3. The cleared-deposit suggestion writes the funded date --------------
// Mark the pending check deposit cleared, which should surface a funded-date
// proposal for the Chen Family Trust (sub 4 has no funded_date... it has none).
await p.evaluate(() => { location.hash = '#/offerings/1?tab=Escrow' })
await p.waitForTimeout(500)
await p.locator('.clear-toggle', { hasText: 'Pending' }).first().click()
await p.waitForTimeout(700)
const sugg = p.locator('.suggest-card', { hasText: 'funded date' })
ok(await sugg.count() >= 1, 'clearing the deposit proposes the funded date')
await sugg.first().locator('button', { hasText: 'Accept' }).click()
await p.waitForTimeout(700)
const sub4 = await p.evaluate(() => JSON.parse(localStorage.getItem('muniment:data')).subscriptions.find(s => s.id === 4))
ok(sub4.funded_date === '2026-07-22', `sub 4 funded date set from the deposit (${sub4.funded_date})`)
ok(sub4.status === 'Funded', `sub 4 advanced to Funded (${sub4.status})`)

// --- 4. The command palette navigates --------------------------------------
await p.keyboard.press('Control+k')
await p.waitForTimeout(300)
ok(await p.locator('.cmd').count() === 1, 'Ctrl-K opens the palette')
await p.keyboard.type('cass')
await p.waitForTimeout(250)
await p.keyboard.press('Enter')
await p.waitForTimeout(500)
ok((await p.evaluate(() => location.hash)).includes('/offerings/2'), 'typing a name and Enter opens the record')
ok(await p.locator('.cmd').count() === 0, 'the palette closed')

// --- 5. Inline investor creation from the subscription form ----------------
await p.evaluate(() => { location.hash = '#/offerings/2?tab=Investors' })
await p.waitForTimeout(500)
await p.locator('#view button', { hasText: 'Add investor' }).first().evaluate(b => b.click())
await p.waitForTimeout(400)
await p.locator('.ac-input').fill('Maria T. Alvarez')
await p.waitForTimeout(300)
const createRow = p.locator('.ac-create')
ok(await createRow.count() === 1, 'the typeahead offers to add the typed name')
await createRow.evaluate(n => n.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
await p.waitForTimeout(600)
const created = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('muniment:data'))
  return d.investors.find(i => i.last_name === 'Alvarez')
})
ok(!!created && created.first_name === 'Maria' && created.middle_name === 'T.' && created.entity_type === 'Individual',
  'the contact was created with split name parts')
ok(await p.evaluate(() => document.querySelector('.ac-input').value) === 'Maria T. Alvarez', 'the picker holds the new contact')
await p.keyboard.press('Escape')

// --- 6. The closing form proposes cleared funds and blocks over-release ----
await p.evaluate(() => { location.hash = '#/offerings/1?tab=Closings' })
await p.waitForTimeout(500)
await p.locator('#view button', { hasText: 'Conduct a closing' }).first().evaluate(b => b.click())
await p.waitForTimeout(400)
const banner = await p.locator('.readiness-banner').innerText()
ok(/Minimum raise/.test(banner), 'the readiness banner is stated first: ' + banner.split('\n')[0])
// select all → the proposal must not exceed the cleared balance
await p.locator('.pick-all input').click()
await p.waitForTimeout(300)
const proposal = await p.evaluate(() => document.querySelectorAll('.money-input')[0].value)
const clearedBal = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('muniment:data'))
  let c = 0
  for (const e of d.escrow.filter(x => x.offering_id === 1 && x.cleared)) c += (e.txn_type === 'deposit' ? 1 : -1) * e.amount_cents
  return c / 100
})
ok(Number(proposal) <= clearedBal + 0.001, `the proposed release (${proposal}) stays within cleared escrow (${clearedBal})`)
await p.keyboard.press('Escape')

console.log('page errors:', errors.length ? errors : 'none')
if (errors.length) fails.push('console errors')
await b.close()
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nINTERACTIONS OK')
process.exit(fails.length ? 1 : 0)
