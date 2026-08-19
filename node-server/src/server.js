/**
 * Muniment, served over http.
 *
 * This used to be a second implementation of the whole application — its own
 * routes, its own views, its own SQLite schema — and the README admitted it
 * "has the Muniment identity but not the newest features". Two implementations
 * of a securities ledger that disagree with one another is a liability with no
 * compensating benefit: the same offering could show two different balances
 * depending on which one you opened.
 *
 * So it is now what it should always have been — a host. It serves the same
 * Muniment.html the rest of the world double-clicks, and the app inside it
 * behaves identically because it *is* identical. Records are kept by the
 * browser exactly as they are when the file is opened from disk.
 *
 * No dependencies, so `npm start` needs no `npm install` first.
 *
 * Anyone with records in the old SQLite database should run the export once
 * before switching: see src/export-sqlite.js.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = join(ROOT, 'Muniment.html')

// This is a single-user local tool. Bind to localhost only so it is never
// exposed to the network.
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 4000)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

// Only the app itself and the brand assets beside it. Everything else in the
// repository — the source it is built from, the tests, the git history — has
// no business being served, and a path that climbs out of it is not served
// however it is spelled.
const ALLOWED = /^(brand\/|Muniment\.html$)/
function resolve (urlPath) {
  let raw
  try { raw = decodeURIComponent(String(urlPath).split('?')[0]) } catch { return null }
  if (raw === '/' || raw === '/index.html') return APP
  // Normalised first, so ".." is resolved rather than merely looked for, then
  // checked against the allow-list by what it actually points at.
  const rel = normalize(raw).replace(/\\/g, '/').replace(/^\/+/, '')
  if (!ALLOWED.test(rel)) return null
  const full = join(ROOT, rel)
  // Belt and braces: the allow-list should already have settled it.
  return full.startsWith(ROOT + '/') || full === APP ? full : null
}

const server = createServer(async (req, res) => {
  const file = resolve(req.url || '/')
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return }
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      // The app is the whole product and changes when it is rebuilt; never
      // let a stale copy sit in the browser cache.
      'cache-control': 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Muniment is being served at http://${HOST}:${PORT}`)
  console.log('Your records are kept by the browser, exactly as they are when you open the file directly.')
})
