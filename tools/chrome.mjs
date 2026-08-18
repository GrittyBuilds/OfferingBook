#!/usr/bin/env node
/**
 * Muniment chrome test.
 *
 * The frame around the records: tabs, the theme switch, document titles,
 * unknown routes, and — on a phone — the app bar, the bottom tab bar and the
 * More sheet that carries what the sidebar holds on a desktop.
 *
 *   node tools/chrome.mjs
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
const b=await chromium.launch()
const errors=[]

// --- Desktop: clicking tabs, theme toggle, breadcrumb back ---------------
{
  const p=await (await b.newContext({viewport:{width:1400,height:950}})).newPage()
  p.on('pageerror',e=>errors.push(String(e))); p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await p.addInitScript(s=>{localStorage.setItem('muniment:data',JSON.stringify(s))},seed)
  await p.goto(APP); await p.waitForTimeout(400)
  await p.evaluate(()=>{location.hash='#/offerings/1'}); await p.waitForTimeout(500)
  for (const tab of ['Escrow','Certificates','Checklist','Overview']) {
    await p.locator('.tab',{hasText:new RegExp('^'+tab+'$')}).click(); await p.waitForTimeout(350)
    const active = await p.locator('.tab.active').innerText()
    ok(active===tab, `clicking the ${tab} tab activates it`)
  }
  ok((await p.evaluate(()=>location.hash)).includes('tab=Overview')===false,'the Overview tab drops the query')
  // theme toggle keeps its label
  await p.locator('#theme-toggle').click(); await p.waitForTimeout(250)
  ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='dark','the toggle switches to dark')
  ok((await p.locator('#theme-toggle').innerText()).trim()==='Dark','and its label follows')
  await p.locator('#theme-toggle').click(); await p.waitForTimeout(250)
  ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='light','and back to light')
  // document title tracks the record
  await p.evaluate(()=>{location.hash='#/investors/1'}); await p.waitForTimeout(400)
  ok((await p.title()).startsWith('Jane'),'the document title names the record: '+await p.title())
  // an unknown id does not throw
  await p.evaluate(()=>{location.hash='#/offerings/999'}); await p.waitForTimeout(500)
  const t=await p.locator('#view').innerText()
  ok(/could not be built|not found/i.test(t),'an unknown record fails gracefully')
  await p.close()
}

// --- Phone: bottom nav, More sheet, active state on Settings -------------
{
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const p=await ctx.newPage()
  p.on('pageerror',e=>errors.push(String(e))); p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await p.addInitScript(s=>{localStorage.setItem('muniment:data',JSON.stringify(s))},seed)
  await p.goto(APP); await p.waitForTimeout(500)
  ok(await p.locator('.bottom-nav').isVisible(),'the bottom bar is on screen')
  ok(await p.locator('.sidebar').isVisible()===false,'the sidebar is not')
  ok((await p.locator('#app-bar-title').innerText())==='Dashboard','the app bar names the section')
  await p.locator('.bn-item[data-nav=offerings]').click(); await p.waitForTimeout(500)
  ok(await p.locator('.bn-item[data-nav=offerings]').getAttribute('class').then(c=>c.includes('active')),'the tapped tab lights up')
  ok((await p.locator('#app-bar-title').innerText())==='Offerings','and the app bar follows')
  // More sheet carries the file controls and the theme
  await p.locator('#bottom-more').click(); await p.waitForTimeout(400)
  const sheet=await p.locator('#modal-root').innerText()
  ok(/Save a copy/.test(sheet),'the More sheet carries the file controls')
  ok(/Appearance/i.test(sheet),'and the appearance switch')
  ok(/Settings/.test(sheet),'and a way to Settings')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  // Settings via the sheet lights nothing wrongly
  await p.evaluate(()=>{location.hash='#/settings'}); await p.waitForTimeout(500)
  const anyActive=await p.evaluate(()=>[...document.querySelectorAll('.bn-item')].filter(n=>n.classList.contains('active')).length)
  ok(anyActive===0,'no bottom tab claims to be Settings, since it has none')
  // the centre add opens quick-add
  await p.locator('#bottom-add').click(); await p.waitForTimeout(400)
  ok(await p.locator('#modal-root .qa-list').count()===1,'the centre button opens the add sheet')
  await p.keyboard.press('Escape')
  await ctx.close()
}
console.log('page errors:', errors.length?errors:'none'); if(errors.length)fails.push('console errors')
await b.close(); console.log(fails.length?`\n${fails.length} FAILURES`:'\nCHROME OK'); process.exit(fails.length?1:0)
