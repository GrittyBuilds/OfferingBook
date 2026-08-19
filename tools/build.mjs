#!/usr/bin/env node
/**
 * Builds Muniment.html from src/.
 *
 * The single file is the product: no installation is not a limitation the app
 * works around, it is the reason it is usable in a small practice at all. So
 * the deliverable stays exactly what it was — one file, no dependencies, open
 * it by double-clicking — and only the source it is assembled from changes.
 *
 * The build is a concatenation and nothing else. There is no minifier, no
 * transpiler and no bundler resolving imports: src/app/*.js are plain scripts
 * that share one scope, in the order listed below, which is the order they
 * appeared in when the file was one file. That is what makes the output
 * reviewable — a diff of Muniment.html is still a diff of the code that runs.
 *
 *   node tools/build.mjs           write Muniment.html
 *   node tools/build.mjs --check   fail if it would differ (for CI)
 *
 * Ordering rules, for anyone adding a file:
 *   - Constants and helpers before what uses them at load time. Function
 *     declarations hoist within a file but not across the concatenation
 *     boundary at module top level, so a `const` read during load must come
 *     first.
 *   - 24-boot.js stays last and stays the only file with a side effect at
 *     load. tools/units.mjs relies on that to load everything else headless.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const OUT = join(ROOT, 'Muniment.html')

// Numeric prefixes decide the order, so adding a file is one rename away from
// being in the right place — and the order is visible in a directory listing
// rather than buried in this script.
const listing = dir => readdirSync(join(SRC, dir)).filter(f => !f.startsWith('.')).sort()

export function build () {
  const shell = readFileSync(join(SRC, 'index.html'), 'utf8')
  const styles = listing('style').map(f => readFileSync(join(SRC, 'style', f), 'utf8'))
  const app = listing('app').map(f => readFileSync(join(SRC, 'app', f), 'utf8'))
  // Each part already ends with a newline; joining on '' keeps the output
  // byte-identical to the file these were split out of.
  //
  // Replacer functions, not strings: the source contains '$' and $& — a money
  // prefix and a regex-escape replacement — and String.replace reads those as
  // replacement patterns when the replacement is a string. A function's return
  // value is taken literally, which is the only safe way to paste code in.
  return shell
    .replace('/*{{ style }}*/\n', () => styles.join(''))
    .replace('/*{{ app }}*/\n', () => app.join(''))
}

const built = build()
if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8')
  if (current === built) {
    console.log('Muniment.html is up to date with src/.')
    process.exit(0)
  }
  console.error('Muniment.html differs from what src/ builds. Run: node tools/build.mjs')
  process.exit(1)
}
writeFileSync(OUT, built)
console.log(`Muniment.html written — ${listing('style').length} stylesheets, ${listing('app').length} scripts, ${built.length.toLocaleString('en-US')} bytes.`)
