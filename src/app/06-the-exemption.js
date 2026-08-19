/* ============================================================================
   THE EXEMPTION — what the record says about the ground the offering stands on.

   Everything here reads facts the app already stored and works out where they
   put the offering. None of it files anything, and none of it is advice; it
   answers questions the file can answer and says which fact each answer came
   from, so the suggestion strip can put them where they will be seen rather
   than leaving them to be remembered.
   ========================================================================== */

// The date of first sale, and which fact fixed it. Rule 503 runs the Form D
// deadline from here, and the app has known it all along: the earliest signed
// subscription, or the earliest deposit that actually cleared.
function firstSale(offeringId){
  offeringId=Number(offeringId);
  const subs=db.subscriptions.filter(s=>s.offering_id===offeringId&&s.status!=='Withdrawn');
  const signed=subs.map(s=>s.sub_signed_date).filter(Boolean).sort()[0]||null;
  const cleared=db.escrow.filter(e=>e.offering_id===offeringId&&e.txn_type==='deposit'&&e.cleared)
    .map(e=>e.txn_date).filter(Boolean).sort()[0]||null;
  if(!signed&&!cleared)return{date:null,from:null};
  if(signed&&(!cleared||signed<=cleared))return{date:signed,from:'the earliest signed subscription'};
  return{date:cleared,from:'the earliest cleared deposit'};
}
// Fifteen calendar days after the first sale, which is what Rule 503 gives.
const FORM_D_DAYS=15;
function addDays(dateStr,n){
  const d=dayOf(dateStr);if(!d)return null;
  const out=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  return `${out.getFullYear()}-${String(out.getMonth()+1).padStart(2,'0')}-${String(out.getDate()).padStart(2,'0')}`;
}
function addYears(dateStr,n){
  const d=dayOf(dateStr);if(!d)return null;
  const out=new Date(d.getFullYear()+n,d.getMonth(),d.getDate());
  return `${out.getFullYear()}-${String(out.getMonth()+1).padStart(2,'0')}-${String(out.getDate()).padStart(2,'0')}`;
}
// Where the offering stands on its Form D. Returns null where the exemption
// does not call for one.
function formDPosition(o){
  if(!o||!/^Reg D/.test(String(o.exemption||'')))return null;
  const sale=firstSale(o.id);
  const due=sale.date?addDays(sale.date,FORM_D_DAYS):null;
  const filed=o.form_d_filed_date||null;
  const live=!['Closed','Terminated'].includes(o.status);
  // The annual amendment falls on or before the anniversary of the last
  // filing, for as long as the offering continues.
  const amendmentDue=filed&&live?addYears(filed,1):null;
  return{
    firstSale:sale.date,from:sale.from,due,filed,
    daysLeft:due?daysUntil(due):null,
    // Filed late is a fact about the file, not a thing to fix now; it is
    // reported once and never nagged about.
    filedLate:!!(filed&&due&&filed>due),
    overdue:!!(due&&!filed&&daysUntil(due)<0),
    amendmentDue,
    amendmentDaysLeft:amendmentDue?daysUntil(amendmentDue):null};
}

// Purchasers on an offering, and what the record establishes about them.
function purchaserStanding(offeringId){
  offeringId=Number(offeringId);
  const subs=db.subscriptions.filter(s=>s.offering_id===offeringId&&s.status!=='Withdrawn');
  const rows=subs.map(s=>({sub:s,investor:db.investors.find(i=>i.id===s.investor_id)||null}));
  const statusOf=r=>(r.investor&&r.investor.accredited_status)||'Unknown';
  return{
    total:rows.length,
    rows,
    verified:rows.filter(r=>statusOf(r)==='Verified'),
    selfCertified:rows.filter(r=>statusOf(r)==='Self-certified'),
    // Established as not accredited. These are the ones the 506(b) ceiling counts.
    nonAccredited:rows.filter(r=>statusOf(r)==='Not accredited'),
    // Neither established nor denied. Not evidence of anything, which is the
    // problem with leaving them there.
    unestablished:rows.filter(r=>statusOf(r)==='Unknown')};
}
// Rule 506(b): no more than thirty-five non-accredited purchasers, and any at
// all bring the Rule 502(b) information-delivery obligation with them.
const RULE_506B_LIMIT=35;

// A verification whose evidence is old enough that a sale today should not
// rest on it. Returns days stale, or null where it does not arise.
function accreditationStaleness(investor,asOf){
  if(!investor||investor.accredited_status!=='Verified')return null;
  const at=investor.accredited_evidence_date||investor.accredited_verified_date;
  if(!at)return null;
  const days=daysBetween(at,asOf||todayISO());
  return days!=null&&days>ACCREDITATION_STALE_DAYS?days:null;
}

/* ---- Blue sky ------------------------------------------------------------
   The checklist compressed the whole of state practice into one line. It is
   one notice filing per state of residence, each with its own fee and its own
   clock — and the record already knows which states are in play, because it
   knows where the subscribers are. */
function stateFilings(offeringId){
  offeringId=Number(offeringId);
  return db.state_filings.filter(f=>f.offering_id===offeringId)
    .sort((a,b)=>String(a.state||'').localeCompare(String(b.state||'')));
}
// A two-letter state from the investor's own field, or read off the tail of
// the address when that is all there is — "…Ann Arbor, MI 48104". A guess is
// only ever offered as a suggestion; nothing is written from one.
function investorState(i){
  if(!i)return null;
  const own=str(i.state);
  if(own&&US_STATES.includes(own.toUpperCase()))return own.toUpperCase();
  const words=String(i.address||'').trim().toUpperCase()
    .replace(/\s+\d{5}(-\d{4})?$/,'')          // a trailing ZIP is not the state
    .split(/[,\s]+/).filter(Boolean);
  const last=words[words.length-1];
  return last&&US_STATES.includes(last)?last:null;
}
// Which states this offering has sold into, with who put each one in play.
function statesInPlay(offeringId){
  offeringId=Number(offeringId);
  const out=new Map();
  for(const s of db.subscriptions.filter(x=>x.offering_id===offeringId&&x.status!=='Withdrawn')){
    const inv=db.investors.find(i=>i.id===s.investor_id);
    const code=investorState(inv);
    if(!code)continue;
    if(!out.has(code))out.set(code,[]);
    out.get(code).push({investor:inv,sub:s});
  }
  return out;
}

/* ---- Party directory ----------------------------------------------------- */
// Issuers, escrow agents, banks and counsel are typed once and picked thereafter.
const PARTY_ROLES=['Issuer','Escrow agent','Counsel','Placement agent','Fund administrator','Other'];
const PARTY_ROLE_KIND={'Issuer':'info','Escrow agent':'success','Counsel':'default','Placement agent':'warn','Fund administrator':'muted','Other':'muted'};
function partiesByRole(role){return db.parties.filter(p=>p.role===role).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));}
function partyById(id){id=Number(id);return db.parties.find(p=>p.id===id)||null;}
function partyFromBody(b){return{
  role:str(b.role)||'Other',name:str(b.name),legal_name:str(b.legal_name),
  contact_name:str(b.contact_name),email:str(b.email),phone:str(b.phone),address:str(b.address),
  tax_id:str(b.tax_id),bank_name:str(b.bank_name),account_number:str(b.account_number),
  state_of_organization:str(b.state_of_organization),entity_form:str(b.entity_form),notes:str(b.notes)};}

/* ---- The inheritance cascade --------------------------------------------- */
// A value is entered at the broadest level it is true of, and read from the
// nearest level that has one. Nothing is copied down at write time — the chain
// is resolved at read time, so correcting the offering corrects every
// subscription that never overrode it.
//
// scope: {certificate?, subscription?, tranche?, offering?, party?}
const INHERIT={
  security_type:[['tranche','security_type'],['offering','security_type'],['settings','default_security_type']],
  exemption:[['offering','exemption'],['settings','default_exemption']],
  price_per_unit_cents:[['tranche','price_per_unit_cents'],['offering','price_per_unit_cents']],
  min_investment_cents:[['tranche','min_investment_cents'],['offering','min_investment_cents'],['settings','default_min_investment_cents']],
  return_rate:[['certificate','pref_return_rate'],['tranche','default_return_rate'],['offering','default_return_rate'],['settings','default_return_rate']],
  class_name:[['certificate','class_name'],['tranche','class_name'],['offeringFn',o=>defaultInvestedClass(o)]],
  costs_label:[['offering','costs_label'],['settings','default_costs_label']],
  escrow_agent:[['offering','escrow_agent'],['partyFn',p=>p&&p.name]],
  escrow_bank:[['offering','escrow_bank'],['partyFn',p=>p&&p.bank_name]],
  escrow_account_number:[['offering','escrow_account_number'],['partyFn',p=>p&&p.account_number]]
};
// Returns {value, from} — `from` names the level so a form can say where a
// value came from without the user having to ask.
function resolveField(scope,field){
  const chain=INHERIT[field];
  if(!chain)return{value:null,from:null};
  const cfg=settings();
  for(const[level,key]of chain){
    let v=null,src=level;
    if(level==='settings'){v=cfg[key]??null;src='the firm defaults';}
    else if(level==='offeringFn'){v=scope.offering?key(scope.offering):null;src='this offering';}
    else if(level==='partyFn'){v=key(scope.party||null);src=scope.party?scope.party.name:'the escrow agent on file';}
    else{const obj=scope[level];v=obj?(obj[key]??null):null;
      src=level==='tranche'?'this tranche':level==='offering'?'this offering':level==='certificate'?'this certificate':level;}
    if(v!==null&&v!==undefined&&v!=='')return{value:v,from:src};
  }
  return{value:null,from:null};
}
// Convenience: the value only.
function inherited(scope,field){return resolveField(scope,field).value;}
// Build a scope from a subscription or certificate without the caller having to.
function scopeFor({offering,tranche,subscription,certificate}={}){
  const o=offering||(subscription?db.offerings.find(x=>x.id===subscription.offering_id):null)
    ||(certificate?db.offerings.find(x=>x.id===certificate.offering_id):null)||null;
  let t=tranche||null;
  if(!t&&subscription&&subscription.tranche_id&&o)t=(o.tranches||[]).find(x=>x.id===subscription.tranche_id)||null;
  const party=o&&o.escrow_party_id?partyById(o.escrow_party_id):null;
  return{offering:o,tranche:t,subscription:subscription||null,certificate:certificate||null,party};
}

