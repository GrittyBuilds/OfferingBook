# CapitalVault

A private, single-user tool for a law firm to run **Regulation D / private
placement (PPM) offerings** — track each offering's process, the investors and
their contact info, the subscriptions, and the escrow funds.

Everything stays **on your own computer**. There is no cloud, no login, and no
data ever leaves your machine.

---

## The app: `CapitalVault.html` — no installation

**To use it, just double-click `CapitalVault.html`** and it opens in your web
browser. There is nothing to install — no Node.js, no server, no setup.

> **Use Google Chrome or Microsoft Edge.** These browsers let the app save your
> data straight to a file on your computer (see below). It will still run in
> other browsers, but the "save to a file you choose" feature is Chrome/Edge only.

### Where your data is stored

When you first open the app, your data is kept **inside the browser** on your
computer (so nothing is lost if you close and reopen it). To store it in a real
**file on your computer** — recommended, so you can back it up and move it
between machines — use the buttons at the bottom-left of the app:

- **New file…** — create a data file (e.g. `capitalvault-data.json`). Put it in a
  synced or encrypted folder (OneDrive, Dropbox, an encrypted drive) and your
  normal backups take care of it. From then on, every change **autosaves** to
  that file.
- **Open file…** — reopen a data file you created earlier (on this or another
  computer).
- **Save a copy** — download a timestamped backup copy at any time.

The little dot in the bottom-left shows the status: **Saved to file** (green) or
**Saved in this browser**. Next time you open the app it will offer to reconnect
to your last file with one click.

### What it tracks

A floating **＋ Add** button in the sidebar lets you create anything — a new
offering, an investor, a subscription, an escrow deposit, a closing, or a
certificate — from any screen (it asks which offering when it needs one).

- **Offerings** — issuer, exemption (Reg D 506(b)/506(c), Reg A, Reg CF, …),
  security type, target min/max raise, price per unit, key dates (launch, Form D,
  closings), escrow agent/bank/account, and status through the deal. Options
  include an **uncapped raise** (no maximum), **fractional investments allowed**
  (minimum may be waived), and an **open-ended offering** (no final close deadline).
  A default **preferred-return / interest rate** can be set for the offering.
- **Pass-through costs** — offerings that charge legal / professional fees to
  investors **on top of** their investment can turn this on; each subscription
  then gets a cost field and the roster shows the **total due** (investment +
  costs) per investor and in the printed summary.
- **Tranches** — an offering can hold multiple **tranches** (sub-series), each
  with its own price, minimums, min/max raise, class, return rate and close date.
  Investors are assigned to a tranche when subscribing.
- **Certificate roster** — on the **Certificates** tab, certificates are
  **created automatically when you conduct a closing**: numbered in **funding-date
  order** (re-numberable, or override individually), with capital contributed,
  **% interest**, preferred-return rate, issue date and **accrued return to date**
  all auto-populated (accrual = capital × rate × days from the closing date). You
  can also add certificates by hand. The roster groups by class with per-class and
  overall subtotals, and is included in the printable summary.
  - **Ownership classes** (optional) — define classes that each represent a fixed
    share of the whole company (e.g. **Common Units = 20%**, **Class A Units =
    80%**). Within a class, holders split by capital, so each certificate shows
    both its **% of its class** and its **total % ownership**. A class can be
    marked **sponsor / non-cash** for units taken for *holding* the offering
    rather than for cash — e.g. the sponsor takes 100% of the Common Units (20% of
    the company) while investors hold 100% of the Class A Units (80%).
- **A built-in process checklist** seeded on every new offering (engagement
  letter → draft PPM → set up escrow → file Form D → collect subs → verify
  accreditation → min-raise met → closing → release funds → post-closing), which
  you can edit.
- **Investors** — a reusable contact book organized into **sections by investor
  type**. Individuals are entered by **first / middle / last name** and listed and
  sorted **last name, first name, middle initial**; entities and trusts are entered
  by entity name with a contact person. Every investor has an **SSN / EIN** field
  (masked in lists), plus email, phone, address, accredited-investor status and
  verification date, and notes. See every offering an investor is in.
- **Subscriptions** — link investors to an offering with amount committed, units,
  optional tranche and pass-through costs, funded date, and subscription-agreement
  status (sent / signed / funded / closed). When adding an investor to an offering,
  **type the name to search** your contact book.
- **Escrow ledger** — deposits, releases, refunds and fees, each pending or
  cleared, with a running **book balance** and **cleared balance**.
  - **Closing conditions / min-raise:** the offering flags when cleared escrow
    reaches the minimum raise, so you know a closing can proceed, and warns on
    approaching close deadlines.
  - **Bank reconciliation:** enter your escrow bank statement balance and the app
    shows whether it matches the cleared balance it has tracked.
- **Multiple closings / tranches** — on the **Closings** tab of an offering,
  "Conduct a closing" to record a closing event: pick which investors are
  included, enter the amount released to the issuer (auto-totaled from the
  selected investors) and any fees deducted. The app records the escrow release
  in the ledger, marks those investors **Closed**, and keeps a per-closing
  history. Deleting a closing cleanly reverses it (removes its escrow entries and
  re-opens its investors). Supports rolling / interim closes.
- **Printable closing / investor summary** — on any offering, click **🖨 Print
  summary** to generate a clean one-click report (offering terms, closing
  readiness / min-raise status, escrow totals, the full investor list with
  contact and accreditation, each closing, and the escrow ledger). Use your
  browser's **Print → Save as PDF** to produce a PDF for a closing binder or
  client update.

### Backups & safety notes

- Your data file is a plain, human-readable `.json` file. Keep regular copies —
  this is client escrow data. "Save a copy" makes a dated backup instantly.
- To restore, use **Open file…** (or **Import**) and pick a backup.
- The app runs entirely in your browser with no network access. Protect the file
  and your computer with your firm's normal security (disk encryption, login).
- This app is a practice-management aid, not legal, accounting, or compliance
  advice, and it does not file anything with the SEC or states for you.

---

## Optional: the local-server version (`node-server/`)

The repository also contains an alternative implementation that runs as a small
local server backed by a **SQLite database** file, for anyone who prefers that
(for example, to later self-host it). **You do not need this** to use
CapitalVault — the single `CapitalVault.html` file above is the recommended way.

The server version requires [Node.js](https://nodejs.org) 20+. To run it:

```bash
cd node-server
npm install
npm start          # then open http://localhost:4000
```

Its data lives in `node-server/data/capitalvault.db`. Note that the two versions
store data separately and do not share it — pick one and stick with it. See the
code under `node-server/` for details.

> The newest features — the global **＋ Add** button, split first/middle/last
> investor names with SSN/EIN and grouped contact book, pass-through costs,
> **tranches**, **ownership classes / sponsor units**, and **automatic
> certificate creation on closing** — are implemented in the recommended
> single-file `CapitalVault.html`. The optional server version does not include
> them.
