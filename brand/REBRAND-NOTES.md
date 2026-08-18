# Muniment — rebrand notes

**From:** CapitalVault (single-file HTML/CSS/JS app)
**To:** Muniment v1.0
**Date:** 18 August 2026
**Prepared for:** Rob Angevine, Seyburn Law PLLC

84 edits, applied by script against the file you sent so every change is
accounted for rather than hand-typed. Nothing in the data model changed. The
whole application is still one file with no install and no network calls.

---

## What's in this kit

| File | What it's for |
|---|---|
| `muniment.css` | The token layer plus base components, ready to drop into any plain HTML/CSS/JS project. Not needed for `Muniment.html` — that file already carries its own copy. |
| `muniment-tokens.json` | The same values framework-neutral, with the measured contrast ratios and the number/date/voice rules. Use this if the app ever moves to React or anything else. |
| `muniment-mark.svg` | The mark in all four colour treatments, with the construction geometry in the `<desc>`. |
| `muniment-mark-only.svg` | The primary mark alone, for embedding. |
| `muniment-favicon.txt` | The favicon as a data URI, ready to paste. |
| `REBRAND-NOTES.md` | This file. |

---

## Your data is safe

This is the part worth reading twice.

**localStorage.** The key moved from `capitalvault:data` to `muniment:data`. On
first launch Muniment reads the new key; if it's empty it falls back to
`capitalvault:data`, then `offeringbook:data`, and adopts whichever it finds.
Verified end to end: data written under the old key loads and renders. Your
browser-held records survive the rename with nothing for you to do.

**Connected data files.** The IndexedDB store name is deliberately still
`offeringbook` — the same choice your last rename made. Changing it would have
orphaned the handle to whatever `.json` file you have connected and forced you
to reconnect. Leave it alone.

**Existing `.json` files.** They load unchanged. New saves write
`meta.app: "Muniment"` instead of `"CapitalVault"`, but files carrying the old
value still open, because nothing reads that field for validation.

**New file names.** Save picker suggests `muniment-data.json`; backups download
as `muniment-backup-<timestamp>.json`. Your existing file keeps its name until
you rename it. There is no reason to.

---

## What changed

### Identity
- Title, favicon, and sidebar lockup — the padlock emoji is gone, replaced by
  the drawn mark and a serif wordmark, with "Record of private offerings"
  beneath it.
- The mark itself appears at the top of every printed offering summary.

### Colour
- The whole palette moved from navy/tan to a deep green with a brass accent,
  on warmed paper neutrals. The old CSS variable names (`--navy`, `--accent`)
  survive as aliases pointing at the new tokens, so nothing broke; new work
  should use `--brand` and `--brass`.
- **Dark theme added,** toggled from the sidebar footer and remembered per
  browser in `muniment:theme`. Light is the default and stays the default for
  anyone who never touches the switch. The theme is set before first paint, so
  there's no white flash on load in dark mode.
- Every colour pairing was measured against WCAG 2.1 AA. Two values from the
  first draft failed and were corrected before shipping: the light muted grey
  (3.86:1 → 5.19:1) and the dark muted grey (4.22:1 → 4.94:1). Full table in
  `muniment-tokens.json`, and the brand guide recomputes it live in the browser.

### Typography and figures
- `font-variant-numeric: tabular-nums` is now global. Every currency column
  aligns on the decimal.
- Micro-labels (stat labels, panel titles, table headers) went smaller and
  wider-tracked — the institutional register.
- Money now uses a true minus sign (U+2212) instead of a hyphen. The hyphen is
  narrower than a digit and breaks column alignment; the minus sign doesn't.

### Icons
- The two colour emoji (🗑 and 🖨) are replaced with drawn SVG icons. The `el()`
  helper learned an `'@icon:name'` token so this stayed a one-line change at
  each call site. Add new icons to the `ICONS` object near the top of the
  script.

### Voice
- "Welcome to CapitalVault" → "Muniment — nothing on record yet", with the
  definition of the word as the explainer.
- The Add button reads **New record** rather than "＋ Add".
- Escrow transaction types read `Deposit — investor to escrow` in the form and
  `Deposit` (capitalised) in the ledger, rather than lowercase with arrows.
- "Confirm escrow minimum (min-raise) met" → "Confirm minimum raise satisfied".
- The report footer was rewritten to be clearer about what the document is not:
  *"Not an offering document, not a filing, and not a substitute for the
  executed instruments. Figures are unaudited."* Worth reading and approving —
  it's the sentence that travels with anything you hand a client.

### Printed reports
- Muniment letterhead, brand-green rules, tinted table headers, brass footer
  rule, serif report title.
- **Reports always print light**, even when the screen is in dark mode. This is
  explicit, not incidental — verified with the print root's computed background
  while the dark theme is active.

---

## Known deviations from the brand guide

Three places where the app and the guide disagree. All deliberate, all
one-line fixes if you'd rather they matched.

1. **Dashboard stat tiles round to whole dollars.** The guide says money always
   carries two decimals. The tiles use the app's existing `moneyShort()`
   formatter and show `$4,011,450`. Summary tiles arguably read better rounded,
   and the ledgers and reports — where it actually matters — all carry cents.
   To change: swap `moneyShort` for `money` in the dashboard render.

2. **Ownership percentages show up to six decimals.** The guide asks for four.
   Six satisfies "at least four" but looks unsettled in a column. The existing
   `fmtPct()` controls this.

3. **Escrow account numbers** are shown as entered. The guide has nothing to
   say here, but if these reports go to clients you may want them masked at
   the display layer rather than relying on how they were typed in.

---

## Applying the kit elsewhere

`Muniment.html` is self-contained and needs nothing from this folder. Use
`muniment.css` when you build something new — a client portal, an intake form,
a second tool — so it lands in the same system:

```html
<head>
  <script>try{var t=localStorage.getItem('muniment:theme');
  document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}
  catch(e){document.documentElement.setAttribute('data-theme','light');}</script>
  <link rel="stylesheet" href="muniment.css">
</head>
```

Classes are namespaced `mn-` so they won't collide with anything: `mn-panel`,
`mn-btn mn-btn--primary`, `mn-pill mn-pill--success`, `mn-table`, `mn-figure`,
`mn-report`.

---

## If you change a colour

Re-measure it. The ratios in `muniment-tokens.json` are load-bearing, not
decoration — a securities report that a client can't read is a real problem,
and "it looked fine on my monitor" is not a test. The brand guide page runs the
calculation in the browser; paste your new hex into the `PAIRS` array at the
bottom of `Muniment-Brand-Guide.html` and it will tell you pass or fail.
