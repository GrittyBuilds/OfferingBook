#!/usr/bin/env node
/**
 * Muniment form test.
 *
 * The "enter it once" promise lives or dies in the forms: what arrives
 * pre-filled, what the app declines to overwrite because a person typed it,
 * and what a picked contact pulls in behind it.
 *
 *   node tools/forms.mjs
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g',{encoding:'utf8'}).trim() + '/playwright/index.js')
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const HERE = dirname(fileURLToPath(import.meta.url))
const APP = 'file://' + (process.env.MUNIMENT_APP || join(HERE, '..', 'Muniment.html'))
const src = readFileSync(join(HERE, 'smoke.mjs'), 'utf8')
const seed = new Function(src.match(/const SEED = \(\(\) => \{([\s\S]*?)\n\}\)\(\)/)[1])()
const fails=[]; const ok=(c,l)=>{console.log((c?'  ok   ':'  FAIL ')+l); if(!c)fails.push(l)}
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1400,height:950}})
const p = await ctx.newPage()
const errors=[]; p.on('pageerror',e=>errors.push(String(e))); p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
await p.addInitScript(s=>{localStorage.setItem('muniment:data',JSON.stringify(s))},seed)
await p.goto(APP); await p.waitForTimeout(400)

// --- Escrow form: the context note and the outstanding prefill -------------
await p.evaluate(()=>{location.hash='#/offerings/1?tab=Escrow'}); await p.waitForTimeout(500)
await p.locator('#view button',{hasText:'New entry'}).first().evaluate(x=>x.click()); await p.waitForTimeout(400)
ok(await p.locator('#modal-root .field-note').count()===1,'the escrow form has its context note')
ok(await p.evaluate(()=>document.getElementById('f_txn_date').value)!=='' ,'the date defaults to today')
ok(await p.evaluate(()=>document.getElementById('f_method').value)==='Check','the method follows the last deposit')
// Pick Robert Chen (sub 3, $100,000 committed, nothing received)
await p.locator('.ac-input').fill('Chen, Robert'); await p.waitForTimeout(300)
await p.locator('.ac-item').first().evaluate(n=>n.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})))
await p.waitForTimeout(400)
const note = await p.locator('#modal-root .field-note').innerText()
ok(/Subscribed \$100,000\.00/.test(note),'the note states what the subscriber owes: '+note)
ok(await p.evaluate(()=>document.getElementById('f_amount').value)==='100000.00','the amount prefills to the outstanding balance')
// A typed amount must not be overwritten when picking someone else
await p.evaluate(()=>{document.getElementById('f_amount').value='250.00'})
await p.locator('.ac-input').fill('Public'); await p.waitForTimeout(300)
await p.locator('.ac-item').first().evaluate(n=>n.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})))
await p.waitForTimeout(400)
ok(await p.evaluate(()=>document.getElementById('f_amount').value)==='250.00','a typed amount survives changing the investor')
await p.keyboard.press('Escape'); await p.waitForTimeout(250)

// --- Certificate form: holder_name appears only without a contact ---------
await p.evaluate(()=>{location.hash='#/offerings/1?tab=Certificates'}); await p.waitForTimeout(600)
await p.locator('#view button',{hasText:'Add certificate'}).first().evaluate(x=>x.click()); await p.waitForTimeout(400)
const rowVisible = () => p.evaluate(()=>{const r=document.getElementById('f_holder_name');return r? getComputedStyle(r.closest('.form-row')).display!=='none':false})
ok(await rowVisible(),'with no contact chosen, the holder-name field is offered')
ok(await p.evaluate(()=>document.getElementById('f_cert_number').value)==='1','the certificate opens on the next number')
ok(await p.evaluate(()=>document.getElementById('f_class_name').value)!=='','the class comes from the offering')
await p.locator('.ac-input').fill('Public'); await p.waitForTimeout(300)
await p.locator('.ac-item').first().evaluate(n=>n.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})))
await p.waitForTimeout(400)
ok(!(await rowVisible()),'choosing a contact withdraws the holder-name field')
ok(await p.evaluate(()=>document.getElementById('f_capital').value)==='250000.00','capital fills from their subscription')
ok(await p.evaluate(()=>document.getElementById('f_pref_return_rate').value)==='8','the rate comes down the cascade')
await p.keyboard.press('Escape'); await p.waitForTimeout(250)

// --- Offering form: the party link follows the typed name -----------------
await p.evaluate(()=>{location.hash='#/settings'}); await p.waitForTimeout(500)
await p.locator('#view button',{hasText:/^Add( the first)?$/}).first().evaluate(x=>x.click()); await p.waitForTimeout(400)
await p.evaluate(()=>{document.getElementById('f_role').value='Escrow agent';document.getElementById('f_role').dispatchEvent(new Event('change',{bubbles:true}))})
await p.locator('#f_name').fill('Great Lakes Escrow Co.')
await p.locator('#f_bank_name').fill('Michigan Commerce Bank')
await p.locator('#f_account_number').fill('4471002391')
await p.locator('#modal-root button[type=submit]').click(); await p.waitForTimeout(600)
ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('muniment:data')).parties.length))===1,'the counterparty was saved')

await p.evaluate(()=>{location.hash='#/offerings'}); await p.waitForTimeout(400)
await p.locator('#view button',{hasText:'New offering'}).first().evaluate(x=>x.click()); await p.waitForTimeout(400)
await p.locator('#f_escrow_agent').fill('Great Lakes Escrow Co.')
await p.locator('#f_escrow_agent').dispatchEvent('input'); await p.waitForTimeout(300)
ok(await p.evaluate(()=>document.getElementById('f_escrow_bank').value)==='Michigan Commerce Bank','picking the agent filled its bank')
ok(await p.evaluate(()=>document.getElementById('f_escrow_account_number').value)==='4471002391','and its account number')
ok(await p.evaluate(()=>document.getElementById('f_escrow_party_id').value)==='1','and linked the directory entry')
await p.locator('#f_escrow_agent').fill('Someone Else'); await p.locator('#f_escrow_agent').dispatchEvent('input'); await p.waitForTimeout(300)
ok(await p.evaluate(()=>document.getElementById('f_escrow_party_id').value)==='','a name matching nothing drops the stale link')
ok(await p.evaluate(()=>document.getElementById('f_escrow_bank').value)==='Michigan Commerce Bank','but what was already filled in is left alone')
await p.keyboard.press('Escape')

console.log('page errors:', errors.length?errors:'none'); if(errors.length)fails.push('console errors')
await b.close(); console.log(fails.length?`\n${fails.length} FAILURES`:'\nFORMS OK'); process.exit(fails.length?1:0)
