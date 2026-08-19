/* ============================================================================
   STORE — in-memory data + persistence to file/localStorage
   ========================================================================== */
const LS_KEY='muniment:data';
// Data saved under earlier names, newest first. Migrated on load; nothing is lost in the rename.
const LS_KEYS_OLD=['capitalvault:data','offeringbook:data'];
const THEME_KEY='muniment:theme';
// The document's shape. Bumping this runs the migrations below on load.
const SCHEMA_VERSION=3;
const COLLECTIONS=['offerings','investors','subscriptions','escrow','tasks','reconciliations','closings','certificates','parties','activity',
  // Added in v3.
  'distributions','transfers','capital_calls','state_filings'];
const EMPTY=()=>({meta:{version:SCHEMA_VERSION,app:'Muniment',rev:0},
  seq:{offerings:0,investors:0,subscriptions:0,escrow:0,tasks:0,reconciliations:0,closings:0,certificates:0,parties:0,activity:0,
    distributions:0,transfers:0,capital_calls:0,state_filings:0},
  offerings:[],investors:[],subscriptions:[],escrow:[],tasks:[],reconciliations:[],closings:[],certificates:[],
  // parties: issuers, escrow agents and counsel, entered once and picked thereafter.
  parties:[],
  // activity: everything that has changed the record — what the app proposed
  // and you accepted, and every edit and deletion made by hand. A figure in a
  // securities file should be traceable to when it arrived and what put it there.
  activity:[],
  // distributions: money paid out to holders after a closing, and what each
  // holder's share of it retired.
  distributions:[],
  // transfers: the chain of title. A certificate is cancelled and a successor
  // issued; neither row is ever silently rewritten.
  transfers:[],
  // capital_calls: dated obligations against a commitment, for offerings that
  // fund in stages rather than in one payment.
  capital_calls:[],
  // state_filings: blue sky / state notice filings, one row per state.
  state_filings:[],
  // settings: the firm's own constants — see SETTINGS_DEFAULTS.
  settings:{},
  // dismissed: suggestion keys waved off, with when. Keyed on the fact, so a
  // dismissal sticks until the underlying figures change.
  dismissed:{}});
let db=EMPTY();
let fileHandle=null;
let fileName=null;
// Set when the stored data could not be read. Nothing is written while it is
// true, so an unreadable document is never replaced by an empty one. Any
// deliberate act that replaces the document — opening a file, creating one,
// importing, or starting fresh — is the decision it was waiting for, and
// clears it through adoptDocument().
let readOnly=false;
// Call whenever the user has knowingly chosen what the document should be.
function adoptDocument(next){
  if(next)db=next;
  if(readOnly){readOnly=false;toast('Saving has resumed.','success');}
}

/* ---- Migrations ----------------------------------------------------------
   Adding a key needs no migration: normalize merges defaults in. These are
   for the other kind of change — where an existing record would otherwise be
   read under a rule it was not written under. Each entry states the version it
   produces, and they run in order for any document below it.

   The rule they exist to keep: a figure that was true before an upgrade is
   still true after it. A migration writes down what the old code assumed
   implicitly, so a new default cannot silently restate an old certificate. */
const MIGRATIONS=[
  {to:3,apply(d){
    // Accrual was simple interest on a 365-day year, everywhere, with no way
    // to say otherwise. Write that down on every certificate that already
    // exists so offering-level conventions only ever govern new ones.
    for(const c of d.certificates)if(c.accrual_convention==null)c.accrual_convention='simple/365';
    // Certificate numbering ran off two different rules (one accepted plain
    // integers only, the other stripped non-digits). Infer the format each
    // offering was actually using and record it, so both paths agree from here.
    for(const o of d.offerings){
      if(o.cert_number_format!=null)continue;
      const nums=d.certificates.filter(c=>c.offering_id===o.id)
        .map(c=>String(c.cert_number??'').trim()).filter(Boolean);
      const parsed=nums.map(s=>s.match(/^(.*?)(\d+)$/)).filter(Boolean);
      if(!parsed.length){o.cert_number_format=null;continue;}
      // The commonest prefix wins; the widest zero-padding is kept, since
      // narrowing it would renumber certificates already issued.
      const tally=new Map();
      for(const m of parsed)tally.set(m[1],(tally.get(m[1])||0)+1);
      const prefix=[...tally.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
      const pad=parsed.filter(m=>m[1]===prefix)
        .reduce((w,m)=>Math.max(w,/^0\d/.test(m[2])?m[2].length:1),1);
      o.cert_number_format={prefix,pad};
    }
  }}
];
function migrate(d){
  const from=Number(d.meta&&d.meta.version)||0;
  for(const m of MIGRATIONS)if(from<m.to)m.apply(d);
  d.meta.version=SCHEMA_VERSION;
  return d;
}

function normalize(obj){
  const base=EMPTY();
  const out={...base,...obj,meta:{...base.meta,...(obj.meta||{})},seq:{...base.seq,...(obj.seq||{})},
    // Merged rather than replaced, exactly as meta and seq are, so a file
    // written by an earlier version gains the keys without losing its own.
    settings:{...base.settings,...(obj.settings||{})},
    dismissed:{...base.dismissed,...(obj.dismissed||{})}};
  // The document is Muniment's once it has been adopted; nothing validates
  // against these fields, they simply say who wrote the file last.
  out.meta.app='Muniment';
  for(const k of COLLECTIONS)
    out[k]=Array.isArray(out[k])?out[k].filter(r=>r&&typeof r==='object'):[];
  // Run before the seq pass, so a migration that adds rows still gets counters
  // ahead of the ids it created.
  migrate(out);
  // keep seq counters ahead of any existing ids
  for(const k of COLLECTIONS){
    const maxId=out[k].reduce((m,r)=>Math.max(m,Number(r.id)||0),0);
    out.seq[k]=Math.max(Number(out.seq[k])||0,maxId);
  }
  out.meta.rev=Number(out.meta.rev)||0;
  return out;
}
function parseDB(text){
  const obj=JSON.parse(text);
  if(typeof obj!=='object'||obj===null)throw new Error('Not a valid Muniment data file');
  if(isEnvelope(obj))throw new Error('This file is protected by a passphrase. Open it from the file buttons so it can be unlocked.');
  return normalize(obj);
}
function nextId(kind){db.seq[kind]=(db.seq[kind]||0)+1;return db.seq[kind];}

