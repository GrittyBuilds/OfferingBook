# Muniment

*(MYOO-nih-ment)* — a document held as evidence of title. From the Latin
*munire*, to fortify.

A private, single-user tool for a law firm to run **Regulation D / private
placement (PPM) offerings** — the offerings, the investors, the subscriptions,
the escrow, the closings and the certificates, all in one place, all on your
own computer. There is no cloud, no login, and no data ever leaves your
machine.

Formerly **CapitalVault** (and before that **OfferingBook**). Your existing
data carries over automatically — see [Coming from CapitalVault](#coming-from-capitalvault).

---

## The app: `Muniment.html` — no installation

**Double-click `Muniment.html`** and it opens in your web browser. There is
nothing to install — no Node.js, no server, no setup.

> **Use Google Chrome or Microsoft Edge on a computer.** These browsers let the
> app autosave straight to a file you choose. It also runs on phones, tablets
> and other browsers — see [On a phone or tablet](#on-a-phone-or-tablet).

### Enter it once

The organizing idea of this version: **information is entered once and carries
forward**. You should never have to type the same fact into two places.

- **Settings** (in the sidebar) holds the firm's constants: your firm name and
  letterhead for printed reports, the report footer, and the defaults every
  new offering starts from — exemption, security type, preferred return,
  minimum investment, the pass-through cost label, and your usual escrow
  agent. Set them once; every new offering opens pre-filled.
- **Counterparties** — issuers, escrow agents, counsel — live in a directory
  under Settings. Pick an escrow agent on an offering and its bank and account
  number fill in with it.
- **The checklist is a template.** Refine the process list once under Settings
  and every future offering starts from your version.
- **Forms fill themselves from the record.** A subscription opens on the
  offering's minimum and works out units from the unit price. The escrow form
  shows what the picked subscriber owes and offers the outstanding balance.
  A certificate arrives numbered, classed, rated and dated from the closing
  and the subscription behind it. Typing a new name into an investor search
  offers to create the contact right there.
- **The app proposes what the record already proves.** A strip on the
  dashboard and on each offering suggests the entries you would otherwise
  retype: a funded date taken from the cleared deposit, a status that its own
  dates have overtaken, a checklist step the record evidences ("Form D is
  recorded as filed on 9 March"), a deposit missing from the ledger, two
  contact entries sharing a taxpayer ID. **Nothing is written until you press
  Accept** — this is a securities file, and every figure in it should be one
  you assented to. Accepted changes are listed under Settings; dismissed
  suggestions stay dismissed.

### Where your data is stored

Your data is kept **inside the browser** on your computer, so nothing is lost
when you close it. To store it in a real **file** — recommended, so your
normal backups cover it — use the buttons at the bottom-left (or under
**More** on a phone):

- **New file…** — create a data file (e.g. `muniment-data.json`). Put it in a
  synced or encrypted folder and every change **autosaves** to it.
- **Open file…** — reconnect a data file on this or another computer.
- **Save a copy** — download a timestamped backup at any time.

The dot at the bottom-left shows the save state. Files written by CapitalVault
or OfferingBook open unchanged.

### What it tracks

- **Offerings** — issuer, exemption, security type, min/max raise (or
  uncapped), price per unit, key dates, escrow details, pass-through costs,
  tranches with their own terms, and status through the deal.
- **Investors** — a contact book grouped by type; individuals entered
  first / middle / last and listed *Last, First M.*; SSN/EIN masked in lists;
  accreditation status and verification date.
- **Subscriptions** — amount, units, tranche, agreement dates. The status
  advances itself as the dates are filled in; only *Withdrawn* is ever chosen
  by hand. The roster shows **committed and received** side by side.
- **Escrow** — deposits, releases, refunds and fees, pending or cleared, with
  book and cleared balances, per-investor received amounts, and bank
  reconciliations that are **snapshots** — a reconciliation that agreed in
  July still agrees with July after August's deposits arrive.
- **Closings** — pick the investors, and the form proposes releasing what has
  actually **cleared escrow** (never more than is in the account), states the
  minimum-raise position before you fill anything in, and requires an explicit
  acknowledgement to close below it. Recording a closing writes the escrow
  release, marks the investors closed, and issues their certificates.
- **Certificates** — numbered in funding-date order, grouped by class, with
  % of class, total % ownership and accrued preferred return computed.
  Ownership classes can each represent a fixed share of the company, with a
  sponsor / non-cash class for carried interest.
- **The printed summary** — your firm's letterhead and footer, an as-of date,
  offering terms, closing readiness, the roster (withdrawn investors shown
  struck through and excluded from totals), each closing, the certificate
  roster, and a chronological escrow ledger with a running balance. Print →
  Save as PDF for a closing binder or a client update.

### Working faster

- **Ctrl/Cmd-K** (or `/`) opens a command palette over everything — offerings,
  investors, actions, navigation. Type a few letters of anything.
- **N** starts a new record from anywhere; **D**, **O**, **I**, **S** jump to
  Dashboard, Offerings, Investors, Settings.
- The brass **New record** button creates anything from anywhere, asking which
  offering only when it needs one.
- Light and dark themes; the choice is remembered per browser.

### On a phone or tablet

The same file adapts itself. On a phone the sidebar becomes a top bar and a
bottom tab bar with a centre **+** button; rosters become cards; forms become
bottom sheets that keep their Save button above the keyboard. Nothing else
changes — same data, same features.

On an **iPhone or iPad** every browser is WebKit, which cannot autosave to a
chosen file. Records are still held safely in the browser there; use **Save a
copy** for backups, and open the same file on a computer when you want
autosave.

### Backups & safety notes

- The data file is plain, human-readable JSON. Keep regular copies — this is
  client escrow data. "Save a copy" makes a dated backup instantly.
- The app runs entirely in your browser with no network access. Protect the
  file and your computer with your firm's normal security.
- This app is a practice-management aid, not legal, accounting, or compliance
  advice, and it does not file anything with the SEC or states for you.

### Coming from CapitalVault

Nothing to do. Muniment reads data saved by CapitalVault and OfferingBook —
browser-held records and `.json` files alike — and adopts it on first launch.
A previously connected data file reconnects with one click. New backups
download as `muniment-backup-<timestamp>.json`.

---

## For developers

- `Muniment.html` is the whole application — one file, no dependencies.
- `brand/` holds the design tokens (`muniment-tokens.json`, with measured
  WCAG contrast ratios), the standalone stylesheet (`muniment.css`) for
  anything built alongside the app, the mark, and the rebrand notes.
- `tools/smoke.mjs` is an optional headless test (requires Playwright, e.g.
  the global install): it walks every route at four viewport widths and fails
  on console errors, horizontal overflow, layouts that do not fit the device,
  or broken values. Run `node tools/smoke.mjs` (add `--shots` for
  screenshots).

## Optional: the local-server version (`node-server/`)

An alternative implementation that runs as a small local server backed by a
SQLite database, for anyone who prefers that. **You do not need it** — the
single `Muniment.html` file above is the recommended way, and the two store
data separately.

Requires [Node.js](https://nodejs.org) 20+:

```bash
cd node-server
npm install
npm start          # then open http://localhost:4000
```

Its database lives in `node-server/data/muniment.db` (an existing
`capitalvault.db` or `offeringbook.db` keeps being used automatically). The
server version has the Muniment identity but not the newest features — the
single-file app is where development happens.
