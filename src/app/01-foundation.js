/* ============================================================================
   Muniment — the system of record for private offerings.
   Single-file, no-install web app. Formerly CapitalVault.
   Data is held in memory, mirrored to localStorage (crash safety), and
   autosaved to a real file you choose via the File System Access API.
   ========================================================================== */

/* ---- Constants ---------------------------------------------------------- */
const OFFERING_STATUSES=['Drafting','Filed','Open','Closing','Closed','Terminated'];
const OFFERING_STATUS_KIND={Drafting:'default',Filed:'info',Open:'success',Closing:'warn',Closed:'muted',Terminated:'danger'};
const EXEMPTIONS=['Reg D 506(b)','Reg D 506(c)','Reg D 504','Reg A+ Tier 1','Reg A+ Tier 2','Reg CF','Reg S','Section 4(a)(2)','Intrastate','Other'];
const SECURITY_TYPES=['Common Equity','Preferred Equity','LLC Units','LP Interests','Promissory Note','Convertible Note','SAFE','Revenue Share','Other'];
const ENTITY_TYPES=['Individual','Entity','Trust','Joint','IRA / Retirement'];
// Types whose name is entered as first / middle / last (a natural person).
const PERSON_TYPES=['Individual','Joint','IRA / Retirement'];
// Order the Investors contact book groups appear in.
const ENTITY_TYPE_ORDER=['Individual','Joint','IRA / Retirement','Trust','Entity'];
function isPersonType(t){return PERSON_TYPES.includes(t);}
const ACCREDITED_STATUSES=['Unknown','Self-certified','Verified','Not accredited'];
const ACCREDITED_KIND={Unknown:'muted','Self-certified':'info',Verified:'success','Not accredited':'danger'};
// How accreditation was established. The status says whether; this says what
// the file would show if anyone asked — which is the part that evidences the
// exemption rather than merely asserting it.
const ACCREDITATION_BASES=[
  'Income — individual','Income — joint with spouse','Net worth','Professional certification or licence',
  'Knowledgeable employee of the fund','Director, officer or general partner of the issuer',
  'Entity — assets over the threshold','Entity — all equity owners accredited','Family office or client',
  'Letter from counsel, an accountant or a broker-dealer','Third-party verification service','Other'];
// A verification that is old enough that the next sale should not rest on it.
// Not a rule anywhere in Reg D — a house standard, and stated as one.
const ACCREDITATION_STALE_DAYS=90;
const US_STATES=['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const STATE_NAMES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',PR:'Puerto Rico',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
function stateName(code){return STATE_NAMES[code]||code||'—';}
const SUBSCRIPTION_STATUSES=['Prospect','Sub sent','Sub signed','Funded','Closed','Withdrawn'];
const SUBSCRIPTION_KIND={Prospect:'muted','Sub sent':'info','Sub signed':'warn',Funded:'success',Closed:'success',Withdrawn:'danger'};
const TXN_TYPES=[{value:'deposit',label:'Deposit — investor to escrow'},{value:'release',label:'Release — escrow to issuer'},{value:'refund',label:'Refund — escrow to investor'},{value:'fee',label:'Fee or expense — out of escrow'}];
const TXN_KIND={deposit:'success',release:'info',refund:'warn',fee:'muted'};
const PAYMENT_METHODS=['Wire','Check','ACH','Other'];
const DEFAULT_CHECKLIST=['Engagement letter signed','Draft Private Placement Memorandum','Draft subscription agreement','Prepare accredited-investor questionnaire','Set up escrow account with escrow agent','Blue sky / state notice filings','File Form D with the SEC','Distribute offering documents to investors','Collect signed subscription agreements','Verify accredited-investor status','Confirm minimum raise satisfied','Hold closing','Release escrow funds to issuer','Post-closing filings / amendments'];

/* ---- Icons — drawn, never typed. Currency of the brand: no emoji. ------- */
const ICONS={
  trash:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 1.5h3.6a.7.7 0 0 1 .7.7v.9h3a.65.65 0 0 1 0 1.3h-.55l-.62 8.4a2 2 0 0 1-2 1.85H5.67a2 2 0 0 1-2-1.85l-.62-8.4H2.5a.65.65 0 0 1 0-1.3h3v-.9a.7.7 0 0 1 .7-.7Zm.6 1.6h2.4v-.3H6.8v.3ZM4.36 4.4l.6 8.3a.7.7 0 0 0 .71.65h4.66a.7.7 0 0 0 .7-.65l.61-8.3H4.36Zm2.29 1.5a.6.6 0 0 1 .6.6v5a.6.6 0 1 1-1.2 0v-5a.6.6 0 0 1 .6-.6Zm2.7 0a.6.6 0 0 1 .6.6v5a.6.6 0 1 1-1.2 0v-5a.6.6 0 0 1 .6-.6Z"/></svg>',
  print:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 1.6h7a.7.7 0 0 1 .7.7v2.2h1.1a1.7 1.7 0 0 1 1.7 1.7v3.6a1.7 1.7 0 0 1-1.7 1.7h-1.1v2a.7.7 0 0 1-.7.7h-7a.7.7 0 0 1-.7-.7v-2H2.7A1.7 1.7 0 0 1 1 9.8V6.2a1.7 1.7 0 0 1 1.7-1.7h1.1V2.3a.7.7 0 0 1 .7-.7Zm.7 2.9h5.6V2.9H5.2v1.6Zm0 8.5h5.6V9.6H5.2V13Zm7-6.6a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>',
  edit:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.6 1.7a1.6 1.6 0 0 1 2.26 0l.44.44a1.6 1.6 0 0 1 0 2.26l-7.5 7.5a1.4 1.4 0 0 1-.63.36l-2.62.7a.7.7 0 0 1-.86-.86l.7-2.62a1.4 1.4 0 0 1 .36-.63l7.85-7.15Zm1.2 1.06a.2.2 0 0 0-.28 0l-.72.72 1.72 1.72.72-.72a.2.2 0 0 0 0-.28l-1.44-1.44ZM4.9 9.86l-.4 1.5 1.5-.4 5.5-5.5-1.1-1.1-5.5 5.5Z"/></svg>',
  plus:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.1a.8.8 0 0 1 .8.8v4.3h4.3a.8.8 0 0 1 0 1.6H8.8v4.3a.8.8 0 0 1-1.6 0V8.8H2.9a.8.8 0 0 1 0-1.6h4.3V2.9a.8.8 0 0 1 .8-.8Z"/></svg>',
  check:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 4.1a.8.8 0 0 1 0 1.13l-6.1 6.1a.8.8 0 0 1-1.13 0L2.9 8a.8.8 0 0 1 1.13-1.13l2.8 2.81 5.54-5.54a.8.8 0 0 1 1.13 0Z"/></svg>',
  close:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.05 4.05a.8.8 0 0 1 1.13 0L8 6.87l2.82-2.82a.8.8 0 1 1 1.13 1.13L9.13 8l2.82 2.82a.8.8 0 0 1-1.13 1.13L8 9.13l-2.82 2.82a.8.8 0 0 1-1.13-1.13L6.87 8 4.05 5.18a.8.8 0 0 1 0-1.13Z"/></svg>',
  warning:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.13 2.15a1 1 0 0 1 1.74 0l5.5 9.6a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5l5.5-9.6ZM8 5.2a.7.7 0 0 0-.7.73l.16 3a.54.54 0 0 0 1.08 0l.16-3A.7.7 0 0 0 8 5.2Zm0 5.1a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z"/></svg>',
  sparkle:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.4a.5.5 0 0 1 .48.36l.75 2.53 2.53.75a.5.5 0 0 1 0 .96l-2.53.75-.75 2.53a.5.5 0 0 1-.96 0l-.75-2.53-2.53-.75a.5.5 0 0 1 0-.96l2.53-.75.75-2.53A.5.5 0 0 1 8 1.4Zm4.3 7.3a.45.45 0 0 1 .43.32l.4 1.35 1.35.4a.45.45 0 0 1 0 .86l-1.35.4-.4 1.35a.45.45 0 0 1-.86 0l-.4-1.35-1.35-.4a.45.45 0 0 1 0-.86l1.35-.4.4-1.35a.45.45 0 0 1 .43-.32Zm-8.6 1.5a.4.4 0 0 1 .38.28l.3 1 1 .3a.4.4 0 0 1 0 .76l-1 .3-.3 1a.4.4 0 0 1-.76 0l-.3-1-1-.3a.4.4 0 0 1 0-.76l1-.3.3-1a.4.4 0 0 1 .38-.28Z"/></svg>',
  search:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.1 1.6a5.5 5.5 0 0 1 4.3 8.93l3.03 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.03A5.5 5.5 0 1 1 7.1 1.6Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>',
  chevron:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.1 3.4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4A.75.75 0 0 1 6.1 11.4L9.54 8 6.1 4.46a.75.75 0 0 1 0-1.06Z"/></svg>',
  back:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.9 3.4a.75.75 0 0 1 0 1.06L6.46 8l3.44 3.44a.75.75 0 0 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0Z"/></svg>',
  download:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6a.75.75 0 0 1 .75.75v6.19l1.92-1.92a.75.75 0 1 1 1.06 1.06l-3.2 3.2a.75.75 0 0 1-1.06 0l-3.2-3.2a.75.75 0 0 1 1.06-1.06L7.25 8.54V2.35A.75.75 0 0 1 8 1.6ZM2.6 10.9a.75.75 0 0 1 .75.75v1.05h9.3v-1.05a.75.75 0 0 1 1.5 0v1.35a1.2 1.2 0 0 1-1.2 1.2H3.05a1.2 1.2 0 0 1-1.2-1.2v-1.35a.75.75 0 0 1 .75-.75Z"/></svg>',
  upload:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6a.75.75 0 0 1 .53.22l3.2 3.2a.75.75 0 1 1-1.06 1.06L8.75 4.16v6.19a.75.75 0 0 1-1.5 0V4.16L5.33 6.08a.75.75 0 0 1-1.06-1.06l3.2-3.2A.75.75 0 0 1 8 1.6Zm-5.4 9.3a.75.75 0 0 1 .75.75v1.05h9.3v-1.05a.75.75 0 0 1 1.5 0v1.35a1.2 1.2 0 0 1-1.2 1.2H3.05a1.2 1.2 0 0 1-1.2-1.2v-1.35a.75.75 0 0 1 .75-.75Z"/></svg>',
  file:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.6h5a.7.7 0 0 1 .5.2l3.3 3.3a.7.7 0 0 1 .2.5v8.1a.7.7 0 0 1-.7.7H4a1.2 1.2 0 0 1-1.2-1.2V2.8A1.2 1.2 0 0 1 4 1.6Zm.3 1.5v9.8h7.2V6.2H9.3a.7.7 0 0 1-.7-.7V3.1H4.3Zm5.8.55v1.05h1.05L10.1 3.65Z"/></svg>',
  swap:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.6 1.9a.75.75 0 0 1 .75.75v9.03l1.32-1.32a.75.75 0 1 1 1.06 1.06L5.13 13.8a.75.75 0 0 1-1.06 0L1.47 11.4a.75.75 0 1 1 1.06-1.06l1.32 1.32V2.65a.75.75 0 0 1 .75-.75Zm6.8 12.2a.75.75 0 0 1-.75-.75V4.32L9.33 5.64a.75.75 0 1 1-1.06-1.06L10.87 2.2a.75.75 0 0 1 1.06 0l2.6 2.38a.75.75 0 1 1-1.06 1.06l-1.32-1.32v9.03a.75.75 0 0 1-.75.75Z"/></svg>'
};

/* ---- DOM + format helpers ----------------------------------------------- */
function el(tag,props={},...children){
  const node=document.createElement(tag);
  for(const[k,v]of Object.entries(props||{})){
    if(v===null||v===undefined||v===false)continue;
    if(k==='class')node.className=v;
    else if(k==='html')node.innerHTML=v;
    else if(k==='dataset')Object.assign(node.dataset,v);
    else if(k.startsWith('on')&&typeof v==='function')node.addEventListener(k.slice(2).toLowerCase(),v);
    else if(k in node&&k!=='list'){try{node[k]=v;}catch{node.setAttribute(k,v);}}
    else node.setAttribute(k,v);
  }
  for(const c of children.flat()){
    if(c===null||c===undefined||c===false)continue;
    // '@icon:name' renders a drawn glyph — the brand forbids emoji in the product.
    if(typeof c==='string'&&c.startsWith('@icon:')){
      const svg=ICONS[c.slice(6)];
      if(svg){const w=document.createElement('span');w.className='ic';w.innerHTML=svg;node.appendChild(w);continue;}
    }
    node.appendChild(c instanceof Node?c:document.createTextNode(String(c)));
  }
  return node;
}
function clear(n){while(n.firstChild)n.removeChild(n.firstChild);return n;}
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const usd0=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
// U+2212 MINUS SIGN, not a hyphen: it is figure-width and aligns in a column.
function money(c){return c===null||c===undefined?'—':usd.format(c/100).replace('-','\u2212');}
function moneyShort(c){return c===null||c===undefined?'—':usd0.format(c/100).replace('-','\u2212');}
function centsToInput(c){return c===null||c===undefined?'':(c/100).toFixed(2);}
// Four decimals, always, so a column of ownership percentages lines up and
// visibly sums. Rounding compounds across a class, which is why the brand
// rule asks for four rather than two.
function fmtPct(n,places=4){if(n===null||n===undefined||n==='')return'—';const v=Number(n);
  return isFinite(v)?v.toFixed(places)+'%':'—';}
// Rates read as people say them: 8%, 6.5%, not 8.0000%.
function fmtRate(n){if(n===null||n===undefined||n==='')return'—';const v=Number(n);
  return isFinite(v)?(+v.toFixed(4))+'%':'—';}
// "14 Aug 2026" — day first, no comma, never 08/14/26. en-GB gives exactly
// this shape; the explicit parts avoid any locale drift.
function fmtDate(s){const d=dayOf(s);if(!d)return s?String(s):'—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;}
// Long form for print: "14 August 2026".
function fmtDateLong(s){const d=dayOf(s);if(!d)return s?String(s):'—';
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;}
// With the time, for the trail and for saved versions, where two entries on
// one day need telling apart: "14 Aug 2026, 09:41".
function fmtDateTime(s){
  const d=s?new Date(s):null;
  if(!d||isNaN(d))return s?String(s):'—';
  const hh=String(d.getHours()).padStart(2,'0'),mm=String(d.getMinutes()).padStart(2,'0');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;}
// Today, as the yyyy-mm-dd a date input wants, in local time rather than UTC.
function todayISO(){const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const MONTHS_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
function relDays(d){if(d===null||d===undefined)return'';if(d===0)return'today';return d>0?`in ${d} day${d===1?'':'s'}`:`${-d} day${d===-1?'':'s'} ago`;}
function pill(t,k='default'){return el('span',{class:`pill pill-${k}`},t);}
// action: {label, run} adds a button and holds the toast open longer — long
// enough to notice a delete and take it back, which is what it is for.
function toast(msg,kind='info',action=null){
  const root=document.getElementById('toast-root');
  const t=el('div',{class:`toast toast-${kind}`+(action?' toast-act':'')},msg);
  let timer=null;
  const dismiss=()=>{clearTimeout(timer);t.classList.remove('show');setTimeout(()=>t.remove(),300);};
  if(action)t.appendChild(el('button',{class:'toast-btn',type:'button',onclick:async()=>{
    dismiss();await action.run();}},action.label));
  root.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  timer=setTimeout(dismiss,action?10000:3200);
  return dismiss;
}
// Parsed from the digits rather than by multiplying a float by 100: 1.005 is
// 101 cents at the hand, but 100.49999999999999 in binary floating point, and
// a cent lost at the door is a cent missing from a reconciliation.
function dollarsToCents(v){
  if(v===null||v===undefined||v==='')return null;
  const s=String(v).replace(/[$,\s]/g,'').replace(/\u2212/,'-');
  if(!/^-?\d*(\.\d*)?$/.test(s)||s===''||s==='-'||s==='.')return isFinite(Number(s))?Math.round(Number(s)*100):null;
  const neg=s.startsWith('-');
  const[whole,frac='']=s.replace('-','').split('.');
  const cents=Number(whole||'0')*100+Number((frac+'00').slice(0,2));
  // A third decimal place rounds rather than truncating.
  const extra=frac.length>2?Number(frac[2]):0;
  const total=cents+(extra>=5?1:0);
  return neg?-total:total;}
function str(v){if(v===null||v===undefined)return null;const s=String(v).trim();return s===''?null:s;}
function numOr(v,d=null){if(v===null||v===undefined||v==='')return d;const n=Number(v);return isFinite(n)?n:d;}
function nowISO(){return new Date().toISOString();}
/* ---- Investor name helpers ---------------------------------------------- */
// Full display name, e.g. "Jane Q. Public" or the entity name.
function investorDisplayName(i){
  if(!i)return '—';
  if(isPersonType(i.entity_type)){
    const parts=[i.first_name,i.middle_name,i.last_name].filter(Boolean);
    if(parts.length)return parts.join(' ');
  }
  return i.name||[i.first_name,i.last_name].filter(Boolean).join(' ')||'(unnamed)';
}
// Listing name for individuals: "Last, First M." (sorts naturally by last name).
function investorListName(i){
  if(isPersonType(i.entity_type)&&(i.last_name||i.first_name)){
    const mi=i.middle_name?` ${String(i.middle_name).trim()[0]}.`:'';
    const head=i.last_name||'';const tail=[i.first_name,mi].filter(Boolean).join('').trim();
    return head&&tail?`${head}, ${tail}`:(head||investorDisplayName(i));
  }
  return investorDisplayName(i);
}
// Sort key: individuals by last, first, middle; others by name.
function investorSortKey(i){
  if(isPersonType(i.entity_type))
    return [i.last_name||i.name||'',i.first_name||'',i.middle_name||''].map(s=>String(s).toLowerCase()).join('\u0000');
  return String(i.name||'').toLowerCase();
}
// Mask a stored SSN/EIN for display (show last 4 only).
function fmtTaxId(v){if(!v)return'—';const s=String(v).trim();if(s.length<=4)return s;return '•••'+s.slice(-4);}

/* ---- Components ---------------------------------------------------------- */
// Shown while a view is built. The app reads from memory, so this is usually
// a single frame — which is exactly why it should be a shape and not a word.
function skeleton(rows=3){
  return el('div',{class:'skeleton','aria-hidden':'true'},
    el('div',{class:'sk w40',style:'height:22px'}),
    el('div',{class:'sk w60'}),
    ...Array.from({length:rows},()=>el('div',{class:'sk tall'})));
}

function pageHeader(title,{subtitle,actions,back,inBar=false}={}){
  return el('header',{class:'page-head'+(inBar?' title-in-bar':'')},
    el('div',{},
      back?el('a',{class:'back-link',href:'#'+back.href.replace(/^#/,''),onclick:e=>{e.preventDefault();location.hash=back.href;}},'@icon:back',back.label):null,
      el('h1',{},title),
      subtitle?el('p',{class:'page-sub'},subtitle):null),
    actions?el('div',{class:'page-actions'},...actions):null);
}
function statCard(label,value,{sub,kind}={}){
  return el('div',{class:`stat-card ${kind?'stat-'+kind:''}`},
    el('div',{class:'stat-label'},label),el('div',{class:'stat-value'},value),
    sub?el('div',{class:'stat-sub'},sub):null);
}
function progressBar(pct,{met=false}={}){
  const c=Math.max(0,Math.min(100,pct??0));
  return el('div',{class:'progress'},el('div',{class:`progress-fill ${met?'met':''}`,style:`width:${c}%`}));
}
function emptyState(msg,actionNode){return el('div',{class:'empty'},el('p',{},msg),actionNode||null);}
function detailGrid(pairs){
  return el('dl',{class:'detail-grid'},...pairs.filter(Boolean).flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v??'—')]));
}


/* ---- Register ------------------------------------------------------------
   columns: {key,label,num,primary,hide,cls,render(row)}
     num      right-aligned tabular figures
     primary  the record's name — the card headline on a phone, unlabelled
     hide     carried on a wide screen, dropped from the phone card
   Every cell carries its column name in data-label, which is what the card
   layout shows in place of the header row. */
/* Sorting. A column that says how to compare itself becomes clickable; the
   rest stay as they are, because some columns have no order worth having
   (a row of buttons) and some carry an order the record itself decided
   (certificates run in funding-date sequence, and re-sorting the roster
   should not look like renumbering it).

   Three states, in this cycle: the record's own order, then ascending, then
   descending, then back. The way out is always the order the file is in. */
function sortValue(c,r,i){
  const v=c.sort?c.sort(r,i):null;
  if(v===null||v===undefined)return null;
  return v;
}
function compareBy(c,dir){
  return(a,b)=>{
    const av=sortValue(c,a.row,a.i),bv=sortValue(c,b.row,b.i);
    // Blanks sink, whichever way the column is pointing: "—" is not a small
    // number, it is the absence of one.
    if(av===null&&bv===null)return a.i-b.i;
    if(av===null)return 1;
    if(bv===null)return -1;
    const n=typeof av==='number'&&typeof bv==='number'
      ? av-bv
      : String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
    return (n||a.i-b.i)*dir;
  };
}
function dataTable(columns,rows,{foot,rowAttrs,caption,className=''}={}){
  const cols=columns.filter(Boolean);
  const cell=(c,r,i)=>el('td',{
    class:[c.num?'num':'',c.primary?'rec-primary':'',c.hide?'rec-hide':'',c.cls||''].filter(Boolean).join(' '),
    dataset:{label:c.label||''}},...[].concat(c.render(r,i)));
  const indexed=rows.map((row,i)=>({row,i}));
  const tbody=el('tbody',{});
  // null → the record's own order.
  let sortCol=null,sortDir=1;
  function fill(){
    clear(tbody);
    const ordered=sortCol?indexed.slice().sort(compareBy(sortCol,sortDir)):indexed;
    for(const{row,i}of ordered)
      tbody.appendChild(el('tr',rowAttrs?rowAttrs(row,i):{},...cols.map(c=>cell(c,row,i))));
  }
  const heads=cols.map(c=>{
    const th=el('th',{scope:'col',
      class:[c.num?'num':'',c.hide?'rec-hide':'',c.sort?'sortable':''].filter(Boolean).join(' ')});
    if(!c.sort){th.textContent=c.label||'';return th;}
    const arrow=el('span',{class:'sort-arrow','aria-hidden':'true'});
    const btn=el('button',{class:'sort-btn',type:'button',
      onclick:()=>{
        if(sortCol!==c){sortCol=c;sortDir=1;}
        else if(sortDir===1)sortDir=-1;
        else sortCol=null;
        heads.forEach(h=>h.dataset.sorted='');
        th.dataset.sorted=sortCol===c?(sortDir===1?'asc':'desc'):'';
        th.setAttribute('aria-sort',sortCol===c?(sortDir===1?'ascending':'descending'):'none');
        arrow.textContent=sortCol===c?(sortDir===1?'↑':'↓'):'';
        fill();
      }},c.label||'',arrow);
    th.setAttribute('aria-sort','none');
    th.appendChild(btn);
    return th;
  });
  fill();
  return el('div',{class:'table-wrap'},
    el('table',{class:('data-table responsive '+className).trim()},
      caption?el('caption',{class:'sr-only'},caption):null,
      el('thead',{},el('tr',{},...heads)),
      tbody,
      foot?el('tfoot',{},foot):null));
}
// Edit / delete, drawn and named, at a size a thumb can hit.
function rowActions(...buttons){return el('div',{class:'row-actions'},...buttons.filter(Boolean));}
function iconButton(icon,label,onclick,{danger=false}={}){
  return el('button',{class:'icon-btn'+(danger?' danger':''),type:'button','aria-label':label,title:label,onclick},'@icon:'+icon);
}

/* ---- Modal + forms ------------------------------------------------------ */
let escHandler=null;
let modalOpener=null;   // where focus returns when the dialog closes
function closeModal(){
  const root=document.getElementById('modal-root');clear(root);root.classList.remove('open');
  if(escHandler){document.removeEventListener('keydown',escHandler);escHandler=null;}
  document.body.style.overflow='';
  if(modalOpener&&modalOpener.isConnected)modalOpener.focus();
  modalOpener=null;
}
function openShell(title,contentNode,{wide=false}={}){
  const root=document.getElementById('modal-root');clear(root);
  modalOpener=document.activeElement;
  const titleId='modal-title-'+Math.random().toString(36).slice(2,8);
  const dialog=el('div',{class:`modal ${wide?'modal-wide':''}`,role:'dialog','aria-modal':'true','aria-labelledby':titleId},
    el('div',{class:'modal-head'},el('h2',{id:titleId},title),el('button',{class:'modal-close',type:'button','aria-label':'Close',onclick:closeModal},'@icon:close')),
    contentNode);
  root.appendChild(el('div',{class:'modal-backdrop',onclick:e=>{if(e.target===e.currentTarget)closeModal();}},dialog));
  root.classList.add('open');
  // The page behind the dialog neither scrolls nor takes focus.
  document.body.style.overflow='hidden';
  escHandler=e=>{
    if(e.key==='Escape'){closeModal();return;}
    if(e.key!=='Tab')return;
    const focusables=dialog.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])');
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',escHandler);
  return dialog;
}
function confirmDialog(message,{danger=false,confirmLabel='Confirm'}={}){
  return new Promise(resolve=>{
    const body=el('div',{class:'modal-body'},
      el('p',{class:'confirm-text'},message),
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-ghost',onclick:()=>{closeModal();resolve(false);}},'Cancel'),
        el('button',{class:`btn ${danger?'btn-danger':'btn-primary'}`,onclick:()=>{closeModal();resolve(true);}},confirmLabel)));
    openShell(danger?'Please confirm':'Confirm',body);
  });
}
// Fields support: type text/textarea/select/checkbox/money/number/date/email/tel,
// plus type:'custom' (f.build(value) → {node, get value}) for widgets like the
// investor typeahead, an optional f.showIf(values)→bool to hide fields, an
// f.onChange(values,api) hook, and f.section headers to group fields.
function formModal({title,fields,values={},submitLabel='Save',onSubmit,wide=false}){
  const inputs={};   // name → element or custom controller ({node, value})
  const rowEls={};   // name → the .form-row wrapper (for showIf)
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  const rows=[];
  for(const f of fields){
    if(f.type==='section'){rows.push(el('div',{class:'form-section-head'},f.label));continue;}
    let input,rowEl;const common={id:`f_${f.name}`,name:f.name,placeholder:f.placeholder||''};
    if(f.type==='hidden'){
      input=el('input',{type:'hidden',id:`f_${f.name}`,name:f.name,value:values[f.name]??''});
      inputs[f.name]=input;rowEls[f.name]=input;rows.push(input);continue;
    }
    if(f.type==='custom'){
      const ctrl=f.build(values[f.name]);inputs[f.name]=ctrl;
      rowEl=el('div',{class:`form-row ${f.half?'half':''}`},
        el('label',{},f.label,f.required?el('span',{class:'req'},' *'):null),
        ctrl.node,f.help?el('div',{class:'field-help'},f.help):null);
    }else if(f.type==='checkbox'){
      input=el('input',{id:`f_${f.name}`,name:f.name,type:'checkbox',checked:!!values[f.name]});
      inputs[f.name]=input;
      rowEl=el('div',{class:`form-row ${f.half?'half':''}`},
        el('label',{class:'form-check'},input,el('span',{},f.label),
          f.help?el('span',{class:'field-help',style:'margin-left:6px'},f.help):null));
    }else{
      if(f.type==='textarea')input=el('textarea',{...common,rows:f.rows||3},values[f.name]??'');
      else if(f.type==='select')input=el('select',common,...(f.options||[]).map(o=>{
        const val=typeof o==='object'?o.value:o,label=typeof o==='object'?o.label:o;
        return el('option',{value:val,selected:String(values[f.name]??'')===String(val)},label);
      }));
      else{
        const type=f.type==='money'?'text':(f.type||'text');
        input=el('input',{...common,type,value:values[f.name]??'',min:f.min,step:f.step,
          inputmode:f.type==='money'||f.type==='number'?'decimal':undefined,
          autocomplete:f.autocomplete||undefined});
        if(f.type==='money')input.classList.add('money-input');
        if(f.mono)input.classList.add('mono');
        if(f.datalist){const dlid=`dl_${f.name}`;input.setAttribute('list',dlid);
          input.__dl=el('datalist',{id:dlid},...f.datalist.map(v=>el('option',{value:v})));}
      }
      inputs[f.name]=input;
      rowEl=el('div',{class:`form-row ${f.half?'half':''}`},
        el('label',{for:`f_${f.name}`},f.label,f.required?el('span',{class:'req'},' *'):null),
        f.type==='money'?el('div',{class:'money-wrap'},el('span',{class:'money-prefix'},'$'),input):input,
        input.__dl||null,
        f.help?el('div',{class:'field-help'},f.help):null);
    }
    rowEls[f.name]=rowEl;rows.push(rowEl);
  }
  function readVal(f){const inp=inputs[f.name];if(!inp)return null;
    if(f.type==='checkbox')return inp.checked;
    let v=inp.value;if(typeof v==='string')v=v.trim();return v===''?null:v;}
  function currentValues(){const v={};for(const f of fields){if(f.type==='section')continue;v[f.name]=readVal(f);}return v;}
  function visible(f){return !f.showIf||f.showIf(currentValues());}
  // `changed` is the name of the field the user just touched, or undefined on
  // the first pass. A derived field uses it to tell "the amount moved, so
  // recompute" from "I am being redrawn, leave the user's answer alone".
  function reflow(changed){
    for(const f of fields){if(f.type==='section'||f.type==='hidden'||!rowEls[f.name])continue;
      if(f.showIf)rowEls[f.name].style.display=f.showIf(currentValues())?'':'none';}
    for(const f of fields){if(f.onChange)f.onChange(currentValues(),{setValue,getValue,changed});}}
  function getValue(name){const f=fields.find(x=>x.name===name);return f?readVal(f):null;}
  function setValue(name,val){const inp=inputs[name];if(!inp)return;
    const f=fields.find(x=>x.name===name);
    if(f&&f.type==='checkbox')inp.checked=!!val;else if('value'in inp)try{inp.value=val==null?'':val;}catch{}}
  for(const f of fields){const inp=inputs[f.name];if(!inp||f.type==='hidden')continue;
    const fire=()=>reflow(f.name);
    // A custom control announces itself by dispatching 'change' on its node,
    // which is how the typeahead tells the form a contact has been chosen.
    if(f.type==='custom'){if(inp.node)inp.node.addEventListener('change',fire);continue;}
    const node=inp;
    node.addEventListener('change',fire);
    if(node.tagName==='INPUT'||node.tagName==='TEXTAREA')node.addEventListener('input',fire);}
  const submitBtn=el('button',{class:'btn btn-primary',type:'submit'},submitLabel);
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    const collected={};
    for(const f of fields){if(f.type==='section')continue;collected[f.name]=readVal(f);}
    const missing=fields.find(f=>f.required&&visible(f)&&!collected[f.name]);
    if(missing){errorBox.textContent=`${missing.label} is required.`;errorBox.style.display='block';
      const mi=inputs[missing.name];if(mi&&mi.focus)mi.focus();else if(mi&&mi.node)(mi.node.querySelector('input,select,textarea')||{focus(){}}).focus();return;}
    submitBtn.disabled=true;submitBtn.textContent='Saving…';
    try{await onSubmit(collected);closeModal();}
    catch(err){errorBox.textContent=err.message||'Something went wrong.';errorBox.style.display='block';submitBtn.disabled=false;submitBtn.textContent=submitLabel;}
  }},...rows,errorBox,
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),submitBtn));
  openShell(title,form,{wide});
  reflow();
  const firstField=fields.find(f=>f.type!=='section');
  const first=firstField&&inputs[firstField.name];
  if(first)setTimeout(()=>{if(first.focus)first.focus();else if(first.node){const inp=first.node.querySelector('input,select,textarea');if(inp)inp.focus();}},50);
}

/* ---- Investor typeahead (search-as-you-type) ---------------------------- */
// Returns a controller with .node (to place in a form) and .value (investor id
// as a string, or '' if nothing chosen). Used wherever you pick an investor.
function investorPicker(investors,selectedId,opts={}){
  // opts.allowCreate — offer to create the contact from whatever was typed.
  // opts.preferred   — ids to float to the top (this offering's subscribers).
  // opts.onPick      — called with the chosen investor.
  const byId=new Map(investors.map(i=>[i.id,i]));
  const preferred=new Set((opts.preferred||[]).map(Number));
  let chosen=selectedId!=null&&byId.has(Number(selectedId))?Number(selectedId):'';
  const input=el('input',{type:'text',class:'ac-input',placeholder:'Type a name to search…',autocomplete:'off'});
  const menu=el('div',{class:'ac-menu',style:'display:none'});
  const node=el('div',{class:'ac-wrap'},input,menu);
  if(chosen!=='')input.value=investorDisplayName(byId.get(chosen));
  function hide(){menu.style.display='none';active=-1;}
  let active=-1,shown=[];
  function createRow(){
    const typed=input.value.trim();
    if(!opts.allowCreate||!typed)return null;
    if(investors.some(i=>investorDisplayName(i).toLowerCase()===typed.toLowerCase()))return null;
    return el('div',{class:'ac-item ac-create',onmousedown:async e=>{e.preventDefault();await createFrom(typed);}},
      el('span',{class:'ac-name'},'@icon:plus','Add “'+truncate(typed,40)+'”'),
      el('span',{class:'ac-meta'},guessEntityType(typed)));}
  async function createFrom(typed){
    const entity_type=guessEntityType(typed);
    const body=isPersonType(entity_type)?{entity_type,...splitPersonName(typed)}:{entity_type,name:typed};
    try{
      const created=await api.createInvestor(body);
      investors.push(created);byId.set(created.id,created);
      pick(created);
      toast(`${investorDisplayName(created)} added to the contact book — details can follow.`,'success');
      opts.onPick&&opts.onPick(created);
    }catch(err){toast(err.message,'error');}}
  function render(items){shown=items.slice(0,12);clear(menu);
    const create=createRow();
    if(!shown.length&&!create){menu.appendChild(el('div',{class:'ac-empty'},'No match. Type a full name to add them.'));menu.style.display='block';return;}
    shown.forEach((i,idx)=>menu.appendChild(el('div',{class:'ac-item'+(idx===active?' active':''),
      onmousedown:e=>{e.preventDefault();pick(i);}},
      el('span',{class:'ac-name'},investorListName(i)),
      el('span',{class:'ac-meta'},preferred.has(i.id)?'On this offering':(i.entity_type||'')))));
    if(create)menu.appendChild(create);
    menu.style.display='block';}
  function pick(i){chosen=i.id;input.value=investorDisplayName(i);hide();
    opts.onPick&&opts.onPick(i);
    // Tell whatever form holds this control that its value moved.
    node.dispatchEvent(new Event('change',{bubbles:true}));}
  // Subscribers on this offering sort first: they are who a deposit or a
  // certificate almost always belongs to.
  const order=(a,b)=>(preferred.has(b.id)-preferred.has(a.id))||investorSortKey(a).localeCompare(investorSortKey(b));
  function filter(){const q=input.value.trim().toLowerCase();
    if(!q)return investors.slice().sort(order);
    return investors.filter(i=>investorDisplayName(i).toLowerCase().includes(q)||investorListName(i).toLowerCase().includes(q)||String(i.email||'').toLowerCase().includes(q)||String(i.tax_id||'').includes(q))
      .sort(order);}
  input.addEventListener('input',()=>{const had=chosen;chosen='';active=-1;render(filter());
    if(had!=='')node.dispatchEvent(new Event('change',{bubbles:true}));});
  input.addEventListener('focus',()=>render(filter()));
  input.addEventListener('blur',()=>setTimeout(hide,160));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(menu.style.display==='none')render(filter());active=Math.min(active+1,shown.length-1);render(shown);}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);render(shown);}
    else if(e.key==='Enter'){
      if(menu.style.display==='none')return;
      if(shown[active]){e.preventDefault();pick(shown[active]);}
      // Nothing highlighted but a creatable name typed: Enter creates it, so
      // the keyboard can do what the mouse can.
      else if(opts.allowCreate&&input.value.trim()&&!shown.length){e.preventDefault();createFrom(input.value.trim());}
    }
    else if(e.key==='Escape'){hide();}});
  return {node,get value(){return chosen===''?'':String(chosen);}};
}

