# OfferingBook

A private, single-user tool for a law firm to run **Regulation D / private
placement (PPM) offerings** — track each offering's process, the investors and
their contact info, the subscriptions, and the escrow funds.

Everything stays **on your own computer**. There is no cloud, no login, and no
data ever leaves your machine.

---

## The app: `OfferingBook.html` — no installation

**To use it, just double-click `OfferingBook.html`** and it opens in your web
browser. There is nothing to install — no Node.js, no server, no setup.

> **Use Google Chrome or Microsoft Edge.** These browsers let the app save your
> data straight to a file on your computer (see below). It will still run in
> other browsers, but the "save to a file you choose" feature is Chrome/Edge only.

### Where your data is stored

When you first open the app, your data is kept **inside the browser** on your
computer (so nothing is lost if you close and reopen it). To store it in a real
**file on your computer** — recommended, so you can back it up and move it
between machines — use the buttons at the bottom-left of the app:

- **New file…** — create a data file (e.g. `offeringbook-data.json`). Put it in a
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

- **Offerings** — issuer, exemption (Reg D 506(b)/506(c), Reg A, Reg CF, …),
  security type, target min/max raise, price per unit, key dates (launch, Form D,
  closings), escrow agent/bank/account, and status through the deal.
- **A built-in process checklist** seeded on every new offering (engagement
  letter → draft PPM → set up escrow → file Form D → collect subs → verify
  accreditation → min-raise met → closing → release funds → post-closing), which
  you can edit.
- **Investors** — a reusable contact book: name, entity type, email, phone,
  address, accredited-investor status and verification date, notes. See every
  offering an investor is in.
- **Subscriptions** — link investors to an offering with amount committed, units,
  and subscription-agreement status (sent / signed / funded / closed).
- **Escrow ledger** — deposits, releases, refunds and fees, each pending or
  cleared, with a running **book balance** and **cleared balance**.
  - **Closing conditions / min-raise:** the offering flags when cleared escrow
    reaches the minimum raise, so you know a closing can proceed, and warns on
    approaching close deadlines.
  - **Bank reconciliation:** enter your escrow bank statement balance and the app
    shows whether it matches the cleared balance it has tracked.

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
OfferingBook — the single `OfferingBook.html` file above is the recommended way.

The server version requires [Node.js](https://nodejs.org) 20+. To run it:

```bash
cd node-server
npm install
npm start          # then open http://localhost:4000
```

Its data lives in `node-server/data/offeringbook.db`. Note that the two versions
store data separately and do not share it — pick one and stick with it. See the
code under `node-server/` for details.
