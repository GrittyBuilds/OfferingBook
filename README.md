# OfferingBook

A private, single-user desktop tool for a law firm to run **Regulation D / private
placement (PPM) offerings** — track each offering's process, the investors and their
contact info, the subscriptions, and the escrow funds.

Everything runs and stays **on your own computer**. There is no cloud, no login, and
no data ever leaves your machine. All your data lives in one file you can copy to back up.

---

## What it tracks

- **Offerings** — issuer, exemption (Reg D 506(b)/506(c), Reg A, Reg CF, …), security
  type, target min/max raise, price per unit, key dates (launch, Form D, closings),
  escrow agent/bank/account, and status through the deal.
- **A built-in process checklist** seeded on every new offering (engagement letter →
  draft PPM → set up escrow → file Form D → collect subs → verify accreditation →
  min-raise met → closing → release funds → post-closing), which you can edit.
- **Investors** — a reusable contact book: name, entity type, email, phone, address,
  accredited-investor status and verification date, notes. See every offering an
  investor is in.
- **Subscriptions** — link investors to an offering with amount committed, units, and
  subscription-agreement status (sent / signed / funded / closed).
- **Escrow ledger** — every deposit, release, refund and fee, each marked pending or
  cleared, with a running **book balance** and **cleared balance**.
  - **Closing conditions / min-raise:** the offering flags when cleared escrow reaches
    the minimum raise, so you know a closing can proceed, and warns on approaching
    close deadlines.
  - **Bank reconciliation:** enter your escrow bank statement balance and the app shows
    whether it matches the cleared balance it has tracked.

---

## Requirements

- [Node.js](https://nodejs.org) version 20 or newer (LTS is fine). Install it once.
  To check: open a terminal and run `node --version`.

## Setup (one time)

From this folder, in a terminal:

```bash
npm install
```

## Running the app

```bash
npm start
```

Then open your browser to **http://localhost:4000**.

Leave the terminal window open while you use the app. To stop it, press `Ctrl+C`.

> Tip: you can create a desktop shortcut that runs `npm start` in this folder so you
> don't need to type commands each time.

---

## Your data & backups

- All data is stored in a single SQLite database file at **`data/offeringbook.db`**.
  (The sidebar shows the exact path.)
- **To back up:** click **“Back up data”** in the sidebar to download a timestamped
  copy of the whole database, or simply copy the `data/offeringbook.db` file somewhere
  safe. Keep regular backups — this is client escrow data.
- **To restore:** stop the app, replace `data/offeringbook.db` with your backup copy,
  and start it again.
- The `data/` folder and all backups are excluded from git, so your client data is
  never committed to the repository.

## Privacy & security notes

- The server binds to `127.0.0.1` (localhost) only, so it is **not reachable from the
  network** — only from the computer it runs on.
- There is no authentication because it is a single-user local tool. Anyone with access
  to your computer/user account can open it. Protect it with your normal computer
  login, and keep backups encrypted if your firm's policy requires it.
- This app is a practice-management aid, not legal, accounting, or compliance advice,
  and it does not file anything with the SEC or states for you.

---

## Project layout

```
src/
  server.js            Express app + startup
  db.js                SQLite schema and connection
  summaries.js         Escrow / subscription / min-raise calculations
  util.js              Request helpers (dollars→cents, etc.)
  routes/              One file per resource (offerings, investors, escrow, …)
public/
  index.html           App shell
  css/styles.css       Styling
  js/                  Front-end (vanilla ES modules — no build step)
data/                  Your database (created on first run; git-ignored)
```

## Configuration

Environment variables (optional):

- `PORT` — port to serve on (default `4000`).
- `OFFERINGBOOK_DB` — absolute path to the database file, if you want it stored
  somewhere specific (e.g. an encrypted volume).
