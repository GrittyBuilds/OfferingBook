#!/usr/bin/env node
/**
 * Runs everything.
 *
 *   node tools/test.mjs            all of it
 *   node tools/test.mjs units      just the named suites
 *
 * The units run first and take about a second; they need no browser, and they
 * cover the arithmetic, so a broken figure is usually reported before the
 * browser suites have finished starting. The rest need Playwright:
 *
 *   npm install
 *
 * Every suite reads Muniment.html, so the build is checked first: a suite
 * passing against a stale file would be worse than one failing.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const TOOLS = dirname(fileURLToPath(import.meta.url))
const run = (script, args = []) =>
  spawnSync(process.execPath, [join(TOOLS, script), ...args], { stdio: 'inherit' }).status === 0

const SUITES = [
  ['units', 'the arithmetic, headless'],
  ['smoke', 'every route at four widths'],
  ['forms', 'what each form arrives pre-filled with'],
  ['interactions', 'suggestions, the palette, the closing guard'],
  ['chrome', 'tabs, theme, titles, the phone bars'],
  ['regressions', 'defects pinned so they cannot come back'],
  ['protection', 'the passphrase, and what it must never write'],
  ['exemption', 'Form D, the ceilings, verification, blue sky'],
  ['lifecycle', 'distributions, transfers, calls, the escrow break'],
  ['documents', 'the certificate, the statement, the CSV'],
  ['workflow', 'sorting, filtering, pasting, what is due'],
]

const wanted = process.argv.slice(2)
const suites = wanted.length ? SUITES.filter(([n]) => wanted.includes(n)) : SUITES
if (!suites.length) {
  console.error(`No such suite. Available: ${SUITES.map(([n]) => n).join(', ')}`)
  process.exit(2)
}

console.log('\n══ build ══════════════════════════════════════════════════════')
if (!run('build.mjs', ['--check'])) process.exit(1)

const failed = []
for (const [name, what] of suites) {
  console.log(`\n══ ${name} ${'═'.repeat(Math.max(0, 58 - name.length))}\n   ${what}\n`)
  if (!run(`${name}.mjs`)) failed.push(name)
}

console.log('\n═══════════════════════════════════════════════════════════════')
if (failed.length) {
  console.error(`${failed.length} of ${suites.length} suites failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`All ${suites.length} suites passed.`)
