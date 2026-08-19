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
- **Dates work themselves out.** A checklist step whose date the offering
  already implies arrives carrying it — the Form D window from the date of
  first sale, the pre-closing steps from the close dates — shown in lighter
  type, and moving when the offering moves. Type a date on a step to fix it
  instead.

### What it checks about the exemption

Muniment does not file anything, and none of this is advice. It reads the
facts already in the file and says where they put the offering, in the same
propose-never-write way as everything else:

- **The Form D clock.** Rule 503 runs fifteen days from the date of first
  sale, which the record already knows — the earliest signed subscription, or
  the earliest deposit that cleared. The app works out the deadline, says
  which fact fixed it, and raises the annual amendment while the offering
  continues.
- **The 506(b) ceiling.** Non-accredited purchasers are counted against the
  thirty-five the rule allows, and the first one raises the Rule 502(b)
  information-delivery obligation. A 506(b) offering marked as generally
  solicited is flagged as the contradiction it is.
- **506(c) verification.** Self-certification does not satisfy 506(c), and
  neither does an unrecorded status; both are counted and named.
- **The Rule 506(d) bad-actor inquiry**, recorded on the offering with its
  date and notes.
- **How accreditation was established** — income, net worth, a licence, a
  letter — and when the evidence relied on is old enough to be worth
  refreshing.
- **Blue sky.** States in play are worked out from where the subscribers
  are, and the Filings tab holds one row per state with its date, fee and
  confirmation number.

### After the closing

The file runs for years past the certificate, and so does the app:

- **Distributions**, split preferred-return-first, pro rata by ownership, or
  as a return of capital — every line editable, the parts allocated to the
  cent, and what is paid against the preferred return stops being
  outstanding.
- **Transfers and redemptions.** A transfer cancels the certificate it came
  from and issues a successor pointing back at it, so the chain of title
  survives; a roster asked for as at an earlier date still shows the holder
  who held it then.
- **Capital calls**, for an offering that funds in stages rather than in one
  payment. What a subscriber owes becomes what has been called of them.
- **Breaking escrow**, for the offering that does not reach its minimum by
  its deadline: one guarded action that itemises every refund, writes them,
  withdraws the subscriptions and terminates the offering — and can be taken
  back straight afterwards.

### What it can put on paper

- **The certificate itself** — the holder, what they hold, the preferred
  return with the convention it accrues under, and somewhere to sign.
- **A holder's statement** — their subscriptions across every offering, what
  they funded, the certificates they hold, and what they have been paid.
- **The offering summary** — the closing binder report, as before.
- **CSV**, for the roster, the escrow ledger, the cap table and the contact
  book, with figures a spreadsheet can add up.

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
  accreditation status, how it was established, the date of the evidence, and
  the state that decides which notice filings an offering will need. Paste a
  block of names to bring an existing deal in.
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
- **Certificates** — numbered in funding-date order under a format the
  offering sets, grouped by class, with % of class, total % ownership and
  accrued preferred return computed **as at a date you choose**. Percentages
  are settled so the column totals exactly 100%. Preferred return accrues
  under a convention you pick — simple or compounded, actual/365 or 30/360 —
  recorded on each certificate at issue, so changing it later never restates
  one already issued. Ownership classes can each represent a fixed share of
  the company, with a sponsor / non-cash class for carried interest.
- **The printed summary** — your firm's letterhead and footer, an as-of date,
  offering terms, closing readiness, the roster (withdrawn investors shown
  struck through and excluded from totals), each closing, the certificate
  roster, and a chronological escrow ledger with a running balance. Print →
  Save as PDF for a closing binder or a client update.

### Working faster

- **The dashboard opens on what is due** — everything dated across every
  offering, overdue first, in date order.
- **Every register sorts.** Click a column heading: once for ascending, again
  to reverse, a third time to return to the order the record holds it in. The
  escrow ledger also filters by type, clearance, date range and free text.
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

### Protecting the file

Under **Settings → Protection** you can set a passphrase. From the next save
onward the data file, the copy held in the browser, the saved versions and
every backup you download are encrypted with AES-GCM under a key derived from
it by PBKDF2-HMAC-SHA256.

This matters because the file holds **unmasked Social Security and taxpayer
numbers** beside escrow account numbers. Masking them in lists is a courtesy
to whoever is looking over your shoulder; it does nothing for the file itself.

> **The passphrase is not stored, hinted at, or recoverable.** If it is lost,
> the records are lost with it. Keep it where you keep the rest of the firm's
> credentials.

### Backups & safety notes

- Without a passphrase the data file is plain, human-readable JSON. Keep
  regular copies either way — this is client escrow data. "Save a copy" makes
  a dated backup instantly, and the app says how long it has been since the
  last one.
- **Previous versions.** A short ring of earlier states is kept in this
  browser and can be restored from Settings. It is a way to undo, not a
  backup — for a backup, keep copies of the data file.
- **Undo.** Deleting an offering, a subscriber, a tranche or a closing offers
  Undo for ten seconds afterwards.
- **What changed.** Settings lists every change the record proposed and you
  accepted, and every edit and deletion made by hand.
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

`Muniment.html` is the whole application — one file, no dependencies, opened
by double-clicking. That is the product, not an implementation detail, and
nothing below changes it.

It is **built** from `src/`, so the source can be read and reviewed in pieces
while the deliverable stays a single file:

```bash
node tools/build.mjs           # write Muniment.html from src/
node tools/build.mjs --check   # fail if it would differ (for CI)
```

The build is a concatenation and nothing else — no minifier, no transpiler, no
bundler resolving imports. `src/app/*.js` are plain scripts sharing one scope,
in the order their numeric prefixes give; `src/style/*.css` likewise. A diff of
`Muniment.html` is therefore still a diff of the code that runs.

- `src/index.html` — the shell, with the two placeholders the build fills.
- `src/style/` — tokens, then the premium layer, then the adaptive layer.
- `src/app/` — twenty-four sections, in load order. `24-boot.js` is the only
  one with a side effect at load, which is what lets the tests load the rest
  headless.
- `brand/` — the design tokens (`muniment-tokens.json`, with measured WCAG
  contrast ratios), the standalone stylesheet, the mark, and the rebrand notes.

### Tests

```bash
npm install            # Playwright, for the browser suites
npm test               # everything, build check first
npm test units         # or one suite by name
```

`tools/units.mjs` needs no browser: it loads `src/app/*.js` into a VM with a
stub for the handful of browser globals the top level touches, and calls the
pure functions directly — the accrual conventions, the cent allocation, the
percentage settlement, the certificate numbering, the exemption arithmetic,
the migrations. It runs in about a second, and it is where a money bug should
be caught.

The rest drive a real browser:

- `smoke` — every route at four viewport widths; fails on console errors,
  horizontal overflow, layouts that do not fit the device, or broken values.
  `--shots` also writes screenshots.
- `forms` — what each form arrives pre-filled with, and what it declines to
  overwrite because a person typed it.
- `interactions` — accepting and dismissing suggestions, the command palette,
  inline contact creation, the closing guard.
- `chrome` — tabs, theme, titles, and the phone app bar, tab bar and More
  sheet.
- `regressions` — defects that reached the working tree once, pinned so they
  cannot come back quietly.
- `protection` — the passphrase, and the two ways it could destroy a file:
  writing plaintext after promising not to, and writing anything at all over a
  document nobody has opened.
- `exemption` — the Form D clock, the 506(b) ceiling, 506(c) verification, the
  bad-actor inquiry, blue sky.
- `lifecycle` — distributions, transfers, redemptions, capital calls, the
  escrow break.
- `documents` — the certificate, the holder's statement, the CSV exports.
- `workflow` — sorting, the escrow filter, the pasted contact list, derived
  checklist dates, what needs attention.

### The data file

Plain JSON, or an AES-GCM envelope where a passphrase has been set. `meta.version`
is dispatched on at load: `MIGRATIONS` in `src/app/02-store.js` runs in order for
any document below the current version, and exists for the changes that would
otherwise read an old record under a rule it was not written under. Adding a key
needs no migration — `normalize()` merges defaults in.

## Optional: serving it over http (`node-server/`)

For anyone who prefers a local server to opening a file:

```bash
cd node-server
npm start          # then open http://localhost:4000
```

No `npm install` needed — it has no dependencies. It binds to localhost only.

This used to be a **second implementation** of the whole application, with its
own routes, its own views and its own SQLite schema, and the README admitted it
had "not the newest features". Two implementations of a securities ledger that
disagree with one another is a liability with no compensating benefit, so it is
now what it should always have been: a host. It serves the same
`Muniment.html`, and the app behaves identically because it *is* identical.
Records are kept by the browser exactly as they are when the file is opened
from disk.

**If you have records in the old SQLite database**, export them once before
switching:

```bash
cd node-server
npm install better-sqlite3     # only needed for this, and only once
node src/export-sqlite.js      # writes muniment-from-sqlite.json
```

Then open `Muniment.html` and use **Open file…** (or **Import…**) to adopt it.
The database is read and left alone; keep it until you are satisfied the import
is right.
