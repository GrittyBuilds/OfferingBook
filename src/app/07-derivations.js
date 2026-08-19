/* ============================================================================
   DERIVATIONS — facts the record already proves, computed rather than retyped.
   ========================================================================== */
// Deposits an investor has actually made on an offering.
function investorEscrow(offeringId,investorId,subscriptionId){
  offeringId=Number(offeringId);investorId=Number(investorId);
  let rows=db.escrow.filter(e=>e.offering_id===offeringId&&e.investor_id===investorId);
  // When the ledger links rows to subscriptions and a subscription is asked
  // for, answer for that subscription alone — an investor in two tranches has
  // two funding dates, not one.
  if(subscriptionId!=null&&rows.some(e=>e.subscription_id!=null))
    rows=rows.filter(e=>e.subscription_id==null||e.subscription_id===Number(subscriptionId));
  const dep=rows.filter(e=>e.txn_type==='deposit');
  const cleared=dep.filter(e=>e.cleared);
  const ref=rows.filter(e=>e.txn_type==='refund');
  const sum=xs=>xs.reduce((a,e)=>a+(Number(e.amount_cents)||0),0);
  const clearedDeposits=sum(cleared),clearedRefunds=sum(ref.filter(e=>e.cleared));
  return{
    deposits:sum(dep),
    clearedDeposits,
    refunds:sum(ref),
    clearedRefunds,
    // What of this subscriber's money is actually held: refunded funds are
    // not raised, not releasable, and not funding.
    clearedNet:clearedDeposits-clearedRefunds,
    rows:dep,
    // The earliest cleared deposit is the date the money was good.
    fundedDate:cleared.map(e=>e.txn_date).filter(Boolean).sort()[0]||null
  };
}
// What a subscriber owes: the investment, plus pass-through costs where the
// offering charges them.
function subscriptionDue(sub,offering,asOf){
  const o=offering||db.offerings.find(x=>x.id===sub.offering_id)||{};
  // Where the offering funds in stages, what is owed today is what has been
  // called, not what was promised in total. Everything else is unchanged.
  const principal=o.staged_funding
    ? callsFor(o.id,sub.id,asOf)
    : (sub.amount_committed_cents||0);
  return principal+(o.pass_through_costs?(sub.costs_cents||0):0);
}
// What has been committed, whatever has been called of it.
function subscriptionCommitment(sub){return sub.amount_committed_cents||0;}
// Status is a label over four facts. A human only ever chooses 'Withdrawn'.
function derivedSubStatus(s){
  if(!s)return'Prospect';
  if(s.status==='Withdrawn')return'Withdrawn';
  if(s.closing_id)return'Closed';
  if(s.funded_date)return'Funded';
  if(s.sub_signed_date)return'Sub signed';
  if(s.sub_sent_date)return'Sub sent';
  return'Prospect';
}
const SUB_STATUS_RANK={Prospect:0,'Sub sent':1,'Sub signed':2,Funded:3,Closed:4,Withdrawn:5};
// Never let a stale label understate a figure: score off whichever is further on.
function effectiveSubStatus(s){
  const d=derivedSubStatus(s),stored=s&&s.status||'Prospect';
  if(stored==='Withdrawn'||d==='Withdrawn')return'Withdrawn';
  return(SUB_STATUS_RANK[d]??0)>=(SUB_STATUS_RANK[stored]??0)?d:stored;
}
// Units follow from the amount and the price, unless someone overrode them.
function derivedUnits(sub,scope){
  const price=inherited(scope,'price_per_unit_cents');
  if(!price||!sub.amount_committed_cents)return null;
  const raw=sub.amount_committed_cents/price;
  const frac=scope.offering&&scope.offering.fractional_allowed;
  if(frac)return +raw.toFixed(6);
  // Whole units only: when the amount does not divide by the price there is
  // no unit count to assert, and rounding one up would state an allotment the
  // subscription does not support.
  return Math.abs(raw-Math.round(raw))<1e-6?Math.round(raw):null;
}

/* ---- Activity trail ------------------------------------------------------
   What changed, when, and what put it there — proposals accepted, and every
   edit and deletion made by hand.

   It is still capped, because this is a data file you sync rather than a log
   server. But an audit trail that silently drops its own oldest entries is
   answering the wrong question with confidence: the entry that goes is by
   definition the earliest, which is the one an argument about a figure is most
   likely to need. So the cap is generous, and what it discarded is written
   down and shown — a trail that says "and 40 before these" is honest in a way
   that one which quietly begins in March is not. */
const ACTIVITY_CAP=4000;
function logActivity(kind,summary,offeringId,key){
  db.activity.push({id:nextId('activity'),at:nowISO(),kind,summary,offering_id:offeringId??null,key:key||null});
  if(db.activity.length>ACTIVITY_CAP){
    const cut=db.activity.length-ACTIVITY_CAP;
    const dropped=db.activity.slice(0,cut);
    db.activity=db.activity.slice(cut);
    if(!db.meta.activity_dropped)db.meta.activity_dropped={count:0,through:null};
    db.meta.activity_dropped.count+=cut;
    db.meta.activity_dropped.through=dropped[dropped.length-1].at;
  }
}
// What the trail no longer holds, for the screen that shows it.
function activityDropped(){
  const d=db.meta&&db.meta.activity_dropped;
  return d&&d.count?d:null;
}


/* ---- What the record already knows, for prefilling forms ---------------- */
// The subscription an investor holds on an offering, if any.
function subscriptionFor(offeringId,investorId){offeringId=Number(offeringId);investorId=Number(investorId);
  return db.subscriptions.find(s=>s.offering_id===offeringId&&s.investor_id===investorId)||null;}
// Still to come in: what was subscribed for, less what has been deposited.
function outstanding(sub,offering){
  if(!sub)return null;
  const due=subscriptionDue(sub,offering);
  const e=investorEscrow(sub.offering_id,sub.investor_id,sub.id);
  return Math.max(0,due-(e.deposits-e.refunds));}
/* ---- Certificate numbering -----------------------------------------------
   There used to be two rules for this and they disagreed. Adding a
   certificate by hand accepted plain integers only, so a roster numbered
   A-1 … A-12 was left alone and the next one proposed as "1". Issuing them
   from a closing stripped the non-digits from the same roster and continued
   from 13. Same file, same data, two answers depending on which door you came
   in by.

   There is now one rule, and the offering says what it is: a prefix and a
   width, inferred from what the roster already uses (see MIGRATIONS) and
   editable on the offering. Both paths read it. */
function certNumberFormat(offering){
  const o=typeof offering==='object'?offering:db.offerings.find(x=>x.id===Number(offering));
  const f=(o&&o.cert_number_format)||settings().default_cert_number_format;
  return{prefix:(f&&f.prefix)||'',pad:Math.max(1,Number(f&&f.pad)||1)};
}
function formatCertNumber(offering,n){
  const{prefix,pad}=certNumberFormat(offering);
  return prefix+String(n).padStart(pad,'0');
}
// The highest number already issued under the offering's format. Numbers that
// do not fit the format are ignored rather than coerced — a roster carrying a
// stray "2026-001" should not push the next one to 2026002.
function highestCertNumber(offeringId){
  const o=db.offerings.find(x=>x.id===Number(offeringId));
  const{prefix}=certNumberFormat(o||offeringId);
  const re=new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\d+)$');
  return db.certificates.filter(c=>c.offering_id===Number(offeringId))
    .reduce((m,c)=>{const g=String(c.cert_number??'').trim().match(re);
      return g?Math.max(m,Number(g[1])):m;},0);
}
// The next certificate number for an offering, following the numbering it is
// already using.
function nextCertNumber(offeringId){
  return formatCertNumber(db.offerings.find(x=>x.id===Number(offeringId))||offeringId,
    highestCertNumber(offeringId)+1);}
// The method used on the last deposit for this offering — almost always the
// same wire instructions as the one before.
function lastEscrowMethod(offeringId){offeringId=Number(offeringId);
  // Deposits only: subscribers tend to wire the same way each time, and an
  // escrow agent's ACH fee says nothing about how the next investor will pay.
  const rows=db.escrow.filter(e=>e.offering_id===offeringId&&e.method&&e.txn_type==='deposit');
  return rows.length?rows[rows.length-1].method:null;}
// Date fields open on today unless the firm has turned that off.
function defaultDate(){return settings().date_defaults?todayISO():'';}
// Entity names announce themselves. A guess the user can correct beats a form.
const ENTITY_WORDS=/\b(llc|l\.l\.c|inc|incorporated|corp|corporation|company|co|ltd|limited|lp|l\.p|llp|plc|fund|partners|holdings|trust|foundation|association|ira)\b/i;
function guessEntityType(name){
  const s=String(name||'');
  if(/\btrust\b/i.test(s))return'Trust';
  if(/\bira\b|\broth\b|\bsep\b/i.test(s))return'IRA / Retirement';
  return ENTITY_WORDS.test(s)?'Entity':'Individual';}
// Split a typed personal name into parts without being clever about it.
function splitPersonName(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length<=1)return{first_name:parts[0]||null,middle_name:null,last_name:null};
  return{first_name:parts[0],last_name:parts[parts.length-1],
    middle_name:parts.length>2?parts.slice(1,-1).join(' '):null};}

/* ---- Local API (mirrors the old server shapes) -------------------------- */
function offeringFromBody(b){
  const row={
    name:str(b.name),issuer_name:str(b.issuer_name),exemption:str(b.exemption),security_type:str(b.security_type),
    status:str(b.status)||'Drafting',target_min_cents:dollarsToCents(b.target_min),target_max_cents:dollarsToCents(b.target_max),
    price_per_unit_cents:dollarsToCents(b.price_per_unit),min_investment_cents:dollarsToCents(b.min_investment),
    launch_date:str(b.launch_date),first_close_date:str(b.first_close_date),final_close_date:str(b.final_close_date),
    form_d_filed_date:str(b.form_d_filed_date),escrow_agent:str(b.escrow_agent),escrow_bank:str(b.escrow_bank),
    escrow_account_number:str(b.escrow_account_number),notes:str(b.notes),
    default_return_rate:numOr(b.default_return_rate),
    no_max:b.no_max?1:0,fractional_allowed:b.fractional_allowed?1:0,no_deadline:b.no_deadline?1:0,
    pass_through_costs:b.pass_through_costs?1:0,costs_label:str(b.costs_label),
    // Links into the party directory. The typed names above stay authoritative
    // for display; these let the app fill the rest and keep it in step.
    issuer_party_id:numOr(b.issuer_party_id),escrow_party_id:numOr(b.escrow_party_id),
    // How this offering's certificates are numbered, read by both the manual
    // form and the closing that issues them.
    cert_number_format:{prefix:str(b.cert_prefix)||'',pad:Math.max(1,Math.min(8,numOr(b.cert_pad,1)||1))},
    accrual_convention:str(b.accrual_convention)||null,
    // Funds in one payment, or over a series of calls.
    staged_funding:b.staged_funding?1:0,
    // Rule 506(d): recorded because its absence from the file is the awkward
    // part, not its presence.
    bad_actor_checked_date:str(b.bad_actor_checked_date),
    bad_actor_notes:str(b.bad_actor_notes),
    general_solicitation:b.general_solicitation?1:0};
  if(row.no_max)row.target_max_cents=null;        // uncapped raise — ignore any amount
  if(row.no_deadline)row.final_close_date=null;   // open-ended — ignore any date
  return row;
}
// Display helpers for the optional/"none" states.
function maxRaiseDisplay(o){return o.no_max?'No maximum (uncapped)':(o.target_max_cents!=null?money(o.target_max_cents):'—');}
function minInvestDisplay(o){
  if(o.min_investment_cents!=null)return money(o.min_investment_cents)+(o.fractional_allowed?' · fractional allowed':'');
  return o.fractional_allowed?'Fractional allowed':'—';}
function closeDeadlineDisplay(o){return o.no_deadline?'Open-ended (no deadline)':fmtDate(o.final_close_date);}
function investorFromBody(b){
  const entity_type=str(b.entity_type)||'Individual';
  const person=isPersonType(entity_type);
  const first=str(b.first_name),middle=str(b.middle_name),last=str(b.last_name);
  // Canonical display name: built from name parts for individuals, entity name otherwise.
  let name=str(b.name);
  if(person)name=[first,middle,last].filter(Boolean).join(' ')||name;
  return{
    name,entity_type,
    first_name:person?first:null,middle_name:person?middle:null,last_name:person?last:null,
    tax_id:str(b.tax_id),
    contact_name:str(b.contact_name),email:str(b.email),
    phone:str(b.phone),address:str(b.address),accredited_status:str(b.accredited_status)||'Unknown',
    accredited_verified_date:str(b.accredited_verified_date),
    // How accreditation was established, and the date of the evidence that
    // established it — the part that evidences the exemption rather than
    // merely asserting it.
    accreditation_basis:str(b.accreditation_basis),
    accredited_evidence_date:str(b.accredited_evidence_date),
    // Kept as its own field rather than dug out of the address every time:
    // this decides which state notice filings the offering needs.
    state:(str(b.state)||'').toUpperCase()||null,
    notes:str(b.notes)};}
function subFromBody(b){return{
  investor_id:numOr(b.investor_id),amount_committed_cents:dollarsToCents(b.amount_committed),units:numOr(b.units),
  costs_cents:dollarsToCents(b.costs),tranche_id:numOr(b.tranche_id),funded_date:str(b.funded_date),
  status:str(b.status)||'Prospect',sub_sent_date:str(b.sub_sent_date),sub_signed_date:str(b.sub_signed_date),notes:str(b.notes)};}
function escrowFromBody(b){const type=str(b.txn_type)||'deposit';const valid=['deposit','release','refund','fee'];
  return{investor_id:numOr(b.investor_id),subscription_id:numOr(b.subscription_id),
    txn_type:valid.includes(type)?type:'deposit',
    amount_cents:Math.abs(dollarsToCents(b.amount)||0),txn_date:str(b.txn_date),method:str(b.method),
    reference:str(b.reference),cleared:b.cleared?1:0,notes:str(b.notes)};}

const api={
  async dashboard(){
    const os=db.offerings;const byStatus={};let inEscrow=0,committed=0,minMet=0,active=0;const upcoming=[];
    for(const o of os){const s=offeringSummary(o);byStatus[o.status]=(byStatus[o.status]||0)+1;
      inEscrow+=s.escrow.clearedBalance;committed+=s.subscriptions.committed;if(s.minRaiseMet)minMet++;
      if(!['Closed','Terminated'].includes(o.status))active++;
      const d=daysUntil(o.final_close_date);
      if(d!==null&&d>=0&&!['Closed','Terminated'].includes(o.status))
        upcoming.push({id:o.id,name:o.name,final_close_date:o.final_close_date,days:d,minRaiseMet:s.minRaiseMet});}
    upcoming.sort((a,b)=>a.days-b.days);
    return{offeringCount:os.length,activeCount:active,investorCount:db.investors.length,totalInEscrow:inEscrow,
      totalCommitted:committed,minRaiseMetCount:minMet,byStatus,upcomingClosings:upcoming.slice(0,8)};
  },
  async listOfferings(){return db.offerings.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map(o=>({...o,summary:offeringSummary(o)}));},
  async getOffering(id){id=Number(id);const o=db.offerings.find(x=>x.id===id);if(!o)throw new Error('Offering not found');return{...o,summary:offeringSummary(o)};},
  async createOffering(b){const row=offeringFromBody(b);if(!row.name)throw new Error('Offering name is required');
    const o={id:nextId('offerings'),...row,created_at:nowISO(),updated_at:nowISO()};db.offerings.push(o);
    // The checklist comes from the firm template when one has been saved, so a
    // refinement made on one offering carries to the next.
    const template=(settings().checklist_template&&settings().checklist_template.length)
      ? settings().checklist_template : DEFAULT_CHECKLIST;
    template.forEach((label,i)=>db.tasks.push({id:nextId('tasks'),offering_id:o.id,label,done:0,due_date:null,
      // `proves` names the fact that would evidence this step, so the app can
      // offer to tick it rather than asking twice.
      proves:DEFAULT_CHECKLIST_PROOFS[label]||null,
      sort_order:i,created_at:nowISO()}));
    await persist();return{...o,summary:offeringSummary(o)};},
  async updateOffering(id,b){id=Number(id);const o=db.offerings.find(x=>x.id===id);if(!o)throw new Error('Offering not found');
    const row=offeringFromBody(b);if(!row.name)throw new Error('Offering name is required');Object.assign(o,row,{updated_at:nowISO()});
    await persist();return{...o,summary:offeringSummary(o)};},
  async deleteOffering(id){id=Number(id);
    db.offerings=db.offerings.filter(x=>x.id!==id);db.subscriptions=db.subscriptions.filter(x=>x.offering_id!==id);
    db.escrow=db.escrow.filter(x=>x.offering_id!==id);db.tasks=db.tasks.filter(x=>x.offering_id!==id);
    db.reconciliations=db.reconciliations.filter(x=>x.offering_id!==id);
    // Closings and certificates were being orphaned rather than removed.
    db.closings=db.closings.filter(x=>x.offering_id!==id);
    db.certificates=db.certificates.filter(x=>x.offering_id!==id);
    // Everything else the offering owns goes with it, or the file quietly
    // accumulates rows belonging to something that no longer exists.
    db.distributions=db.distributions.filter(x=>x.offering_id!==id);
    db.transfers=db.transfers.filter(x=>x.offering_id!==id);
    db.capital_calls=db.capital_calls.filter(x=>x.offering_id!==id);
    db.state_filings=db.state_filings.filter(x=>x.offering_id!==id);
    await persist();return{ok:true};},

  // Tranches — sub-series within an offering that may carry their own terms.
  async saveTranche(offeringId,b,trancheId){offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);if(!o)throw new Error('Offering not found');
    if(!Array.isArray(o.tranches))o.tranches=[];
    const row={name:str(b.name),price_per_unit_cents:dollarsToCents(b.price_per_unit),
      min_investment_cents:dollarsToCents(b.min_investment),target_min_cents:dollarsToCents(b.target_min),
      target_max_cents:dollarsToCents(b.target_max),security_type:str(b.security_type),
      class_name:str(b.class_name),default_return_rate:numOr(b.default_return_rate),
      close_date:str(b.close_date),notes:str(b.notes)};
    if(!row.name)throw new Error('Tranche name is required');
    if(trancheId){const t=o.tranches.find(x=>x.id===Number(trancheId));if(!t)throw new Error('Tranche not found');Object.assign(t,row);}
    // Monotonic per offering. Reusing max+1 after a delete would have
    // re-attached the deleted tranche's subscriptions to the new one.
    else{o.tranche_seq=Math.max(Number(o.tranche_seq)||0,o.tranches.reduce((m,t)=>Math.max(m,Number(t.id)||0),0))+1;
      o.tranches.push({id:o.tranche_seq,...row});}
    o.updated_at=nowISO();await persist();return o;},
  async deleteTranche(offeringId,trancheId){offeringId=Number(offeringId);trancheId=Number(trancheId);
    const o=db.offerings.find(x=>x.id===offeringId);if(!o)throw new Error('Offering not found');
    o.tranches=(o.tranches||[]).filter(t=>t.id!==trancheId);
    db.subscriptions.forEach(s=>{if(s.offering_id===offeringId&&s.tranche_id===trancheId)s.tranche_id=null;});
    o.updated_at=nowISO();await persist();return o;},

  // Ownership classes — optional fixed split of the whole company by class
  // (e.g. Common = 20%, Class A = 80%). A "sponsor" class is taken for holding
  // the offering rather than for cash (feature: carried/promote interest).
  async saveClasses(offeringId,classes){offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);if(!o)throw new Error('Offering not found');
    o.classes=(classes||[]).map((c,idx)=>({id:c.id||idx+1,name:str(c.name)||`Class ${idx+1}`,
      total_percent:numOr(c.total_percent),sponsor:c.sponsor?1:0})).filter(c=>c.name);
    o.updated_at=nowISO();await persist();return o;},

  async listInvestors(){return db.investors.slice().sort((a,b)=>investorSortKey(a).localeCompare(investorSortKey(b)))
    .map(i=>({...i,offering_count:db.subscriptions.filter(s=>s.investor_id===i.id).length}));},
  async getInvestor(id){id=Number(id);const inv=db.investors.find(x=>x.id===id);if(!inv)throw new Error('Investor not found');
    const subscriptions=db.subscriptions.filter(s=>s.investor_id===id).map(s=>{
      const o=db.offerings.find(x=>x.id===s.offering_id);return{...s,offering_name:o?o.name:'(deleted)'};})
      .sort((a,b)=>a.offering_name.localeCompare(b.offering_name));
    return{...inv,subscriptions};},
  async createInvestor(b){const row=investorFromBody(b);if(!row.name)throw new Error(isPersonType(row.entity_type)?'A last name is required':'Investor / entity name is required');
    const inv={id:nextId('investors'),...row,created_at:nowISO(),updated_at:nowISO()};db.investors.push(inv);await persist();return inv;},
  async updateInvestor(id,b){id=Number(id);const inv=db.investors.find(x=>x.id===id);if(!inv)throw new Error('Investor not found');
    const row=investorFromBody(b);if(!row.name)throw new Error(isPersonType(row.entity_type)?'A last name is required':'Investor / entity name is required');Object.assign(inv,row,{updated_at:nowISO()});await persist();return inv;},
  async deleteInvestor(id){id=Number(id);
    const certs=db.certificates.filter(c=>c.investor_id===id).length;
    if(certs)throw new Error(`This holder appears on ${certs} certificate${certs===1?'':'s'}. Remove ${certs===1?'it':'them'} first.`);
    const n=db.subscriptions.filter(s=>s.investor_id===id).length;
    if(n>0)throw new Error(`This investor is on ${n} offering subscription(s). Remove those first.`);
    db.investors=db.investors.filter(x=>x.id!==id);db.escrow.forEach(e=>{if(e.investor_id===id)e.investor_id=null;});await persist();return{ok:true};},

  async listSubscriptions(offeringId){offeringId=Number(offeringId);
    return db.subscriptions.filter(s=>s.offering_id===offeringId).map(s=>{const i=db.investors.find(x=>x.id===s.investor_id);
      return{...s,investor_name:i?investorDisplayName(i):null,investor_sort:i?investorSortKey(i):'',
        entity_type:i?i.entity_type:null,email:i?i.email:null,phone:i?i.phone:null,accredited_status:i?i.accredited_status:null};})
      .sort((a,b)=>(a.investor_sort||'').localeCompare(b.investor_sort||''));},
  async createSubscription(offeringId,b){offeringId=Number(offeringId);const row=subFromBody(b);
    if(!row.investor_id)throw new Error('Investor is required');if(!db.investors.find(x=>x.id===row.investor_id))throw new Error('Investor not found');
    const s={id:nextId('subscriptions'),offering_id:offeringId,...row,created_at:nowISO(),updated_at:nowISO()};db.subscriptions.push(s);await persist();return s;},
  async updateSubscription(id,b){id=Number(id);const s=db.subscriptions.find(x=>x.id===id);if(!s)throw new Error('Subscription not found');
    const row=subFromBody(b);if(!row.investor_id)throw new Error('Investor is required');Object.assign(s,row,{updated_at:nowISO()});await persist();return s;},
  async deleteSubscription(id){id=Number(id);
    const s=db.subscriptions.find(x=>x.id===id);
    if(s){
      // Escrow entries booked against this subscription lose their link but
      // stay in the ledger: the money did move, and a ledger that quietly
      // loses a row will not reconcile.
      db.escrow.forEach(e=>{if(e.subscription_id===id)e.subscription_id=null;});
      db.certificates.forEach(c=>{if(c.subscription_id===id)c.subscription_id=null;});
    }
    db.subscriptions=db.subscriptions.filter(x=>x.id!==id);await persist();return{ok:true};},

  async listEscrow(offeringId){offeringId=Number(offeringId);
    const transactions=db.escrow.filter(e=>e.offering_id===offeringId).map(e=>{const i=db.investors.find(x=>x.id===e.investor_id);
      return{...e,investor_name:i?investorDisplayName(i):null};})
      .sort((a,b)=>(b.txn_date||b.created_at||'').localeCompare(a.txn_date||a.created_at||'')||b.id-a.id);
    return{transactions,summary:escrowSummary(offeringId)};},
  async createEscrow(offeringId,b){offeringId=Number(offeringId);const row=escrowFromBody(b);
    if(!row.amount_cents)throw new Error('Amount must be greater than zero');
    const e={id:nextId('escrow'),offering_id:offeringId,...row,created_at:nowISO()};db.escrow.push(e);await persist();return e;},
  async updateEscrow(id,b){id=Number(id);const e=db.escrow.find(x=>x.id===id);if(!e)throw new Error('Transaction not found');
    const row=escrowFromBody(b);if(!row.amount_cents)throw new Error('Amount must be greater than zero');Object.assign(e,row);await persist();return e;},
  async deleteEscrow(id){id=Number(id);db.escrow=db.escrow.filter(x=>x.id!==id);await persist();return{ok:true};},

  async listTasks(offeringId){offeringId=Number(offeringId);return db.tasks.filter(t=>t.offering_id===offeringId).sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);},
  async createTask(offeringId,b){offeringId=Number(offeringId);const label=str(b.label);if(!label)throw new Error('Task label is required');
    const order=db.tasks.filter(t=>t.offering_id===offeringId).reduce((m,t)=>Math.max(m,t.sort_order),-1)+1;
    const t={id:nextId('tasks'),offering_id:offeringId,label,done:0,due_date:str(b.due_date),sort_order:order,created_at:nowISO()};db.tasks.push(t);await persist();return t;},
  async updateTask(id,b){id=Number(id);const t=db.tasks.find(x=>x.id===id);if(!t)throw new Error('Task not found');
    if('label'in b&&str(b.label))t.label=str(b.label);if('done'in b)t.done=b.done?1:0;
    if('done_date'in b)t.done_date=str(b.done_date);if('due_date'in b)t.due_date=str(b.due_date);
    if('sort_order'in b)t.sort_order=numOr(b.sort_order,t.sort_order);await persist();return t;},
  async deleteTask(id){id=Number(id);db.tasks=db.tasks.filter(x=>x.id!==id);await persist();return{ok:true};},

  // A reconciliation is a snapshot, not a live comparison. What the app's
  // cleared balance was at the moment it was struck is stored on the record;
  // recomputing it later would let a reconciliation that agreed in July show a
  // variance in August because a deposit cleared in between. Records written
  // before this was stored fall back to the live figure, which is what they
  // have always shown.
  async listReconciliations(offeringId){offeringId=Number(offeringId);const summary=escrowSummary(offeringId);
    const reconciliations=db.reconciliations.filter(r=>r.offering_id===offeringId)
      .sort((a,b)=>(b.statement_date||b.created_at||'').localeCompare(a.statement_date||a.created_at||'')||b.id-a.id)
      .map(r=>{const app=r.app_cleared_cents!=null?r.app_cleared_cents:summary.clearedBalance;
        return{...r,app_cleared_cents:app,difference_cents:r.statement_balance_cents-app,
          historical:r.app_cleared_cents!=null};});
    return{reconciliations,summary};},
  async createReconciliation(offeringId,b){offeringId=Number(offeringId);const bal=dollarsToCents(b.statement_balance);
    if(bal===null)throw new Error('Statement balance is required');
    const app=escrowSummary(offeringId).clearedBalance;
    const r={id:nextId('reconciliations'),offering_id:offeringId,statement_date:str(b.statement_date),
      statement_balance_cents:bal,app_cleared_cents:app,difference_cents:bal-app,
      notes:str(b.notes),created_at:nowISO()};
    db.reconciliations.push(r);await persist();return r;},
  async deleteReconciliation(id){id=Number(id);db.reconciliations=db.reconciliations.filter(x=>x.id!==id);await persist();return{ok:true};},

  // Closings / tranches. A closing records a release of escrow to the issuer and
  // marks the included investors' subscriptions closed.
  async listClosings(offeringId){offeringId=Number(offeringId);
    const closings=db.closings.filter(c=>c.offering_id===offeringId)
      .sort((a,b)=>(b.closing_date||b.created_at||'').localeCompare(a.closing_date||a.created_at||'')||b.id-a.id)
      .map(c=>{
        const subs=db.subscriptions.filter(s=>s.closing_id===c.id).map(s=>{const i=db.investors.find(x=>x.id===s.investor_id);
          return{...s,investor_name:i?investorDisplayName(i):'(deleted investor)'};});
        return{...c,investors:subs,investor_count:subs.length};
      });
    return{closings,totalReleased:closings.reduce((a,c)=>a+(c.amount_released_cents||0),0)};},
  async createClosing(offeringId,b){offeringId=Number(offeringId);
    if(!db.offerings.find(x=>x.id===offeringId))throw new Error('Offering not found');
    const amount=Math.abs(dollarsToCents(b.amount_released)||0);
    const fees=Math.abs(dollarsToCents(b.fees)||0);
    if(!amount&&!fees)throw new Error('Enter an amount released to the issuer.');
    const subIds=(Array.isArray(b.investor_sub_ids)?b.investor_sub_ids:[]).map(Number);
    const count=db.closings.filter(c=>c.offering_id===offeringId).length;
    const label=str(b.label)||`Closing ${count+1}`;
    // A closing recorded without a date is a closing held today: leaving it
    // null stopped certificates accruing and broke their numbering order.
    const date=str(b.closing_date)||todayISO();
    const closing={id:nextId('closings'),offering_id:offeringId,label,closing_date:date,
      amount_released_cents:amount,fees_cents:fees,notes:str(b.notes),created_at:nowISO()};
    db.closings.push(closing);
    // Record the escrow movements so the ledger and balances stay correct.
    if(amount>0)db.escrow.push({id:nextId('escrow'),offering_id:offeringId,investor_id:null,txn_type:'release',
      amount_cents:amount,txn_date:date,method:null,reference:label,cleared:1,notes:`Release to issuer — ${label}`,
      created_at:nowISO(),closing_id:closing.id});
    if(fees>0)db.escrow.push({id:nextId('escrow'),offering_id:offeringId,investor_id:null,txn_type:'fee',
      amount_cents:fees,txn_date:date,method:null,reference:label,cleared:1,notes:`Closing costs — ${label}`,
      created_at:nowISO(),closing_id:closing.id});
    // Link and (optionally) close the included subscriptions.
    const markClosed=b.mark_closed!==false;
    for(const sid of subIds){const s=db.subscriptions.find(x=>x.id===sid&&x.offering_id===offeringId);
      if(s){s.closing_id=closing.id;if(markClosed)s.status='Closed';
      // Remember that the closing supplied this date, so undoing the closing
      // can take it back rather than leaving a subscriber on record as funded
      // on a day nothing arrived.
      if(!s.funded_date){s.funded_date=date;s.funded_date_from_closing=closing.id;}
      s.updated_at=nowISO();}}
    // Auto-issue certificates for the included investors (feature: certificates on closing).
    let certsIssued=0;
    if(b.issue_certs!==false)certsIssued=generateCertificatesForClosing(offeringId,closing,subIds);
    closing.certs_issued=certsIssued;
    await persist();return{...closing,certsIssued};},
  async deleteClosing(id){id=Number(id);const c=db.closings.find(x=>x.id===id);if(!c)throw new Error('Closing not found');
    // Reverse: remove its escrow entries, auto-issued certificates, and un-close its subscriptions.
    db.escrow=db.escrow.filter(e=>e.closing_id!==id);
    db.certificates=db.certificates.filter(cert=>cert.closing_id!==id);
    db.subscriptions.forEach(s=>{if(s.closing_id===id){
      s.closing_id=null;
      // Give back the funding date the closing invented…
      if(s.funded_date_from_closing===id){s.funded_date=null;delete s.funded_date_from_closing;}
      // …and fall back to what the subscription's own dates say, rather than
      // promoting a prospect who never paid to Funded.
      if(s.status==='Closed')s.status=derivedSubStatus({...s,closing_id:null});
      s.updated_at=nowISO();}});
    db.closings=db.closings.filter(x=>x.id!==id);await persist();return{ok:true};},

  // Certificate roster — units/interests issued to holders, possibly across
  // multiple classes/series, with % interest and accrued preferred return.
  async listCertificates(offeringId,asOf){offeringId=Number(offeringId);
    const r=computeCertificates(offeringId,asOf);
    return{certificates:r.certificates,classNames:r.classNames,classes:r.classes,classCapital:r.classCapital,
      hasClassTotals:r.hasClassTotals,asOf:r.asOf,
      totalCapital:r.totalCapital,
      totalAccrued:r.certificates.reduce((a,c)=>a+(c.accrued_calc||0),0),
      totalOutstanding:r.certificates.reduce((a,c)=>a+(c.accrued_outstanding||0),0),
      totalPercent:r.certificates.reduce((a,c)=>a+(Number(c.total_pct_shown)||0),0)};},
  async createCertificate(offeringId,b){offeringId=Number(offeringId);
    if(!db.offerings.find(x=>x.id===offeringId))throw new Error('Offering not found');
    const row=certFromBody(b);if(!row.cert_number)throw new Error('Certificate # is required');
    const c={id:nextId('certificates'),offering_id:offeringId,...row,created_at:nowISO()};db.certificates.push(c);await persist();return c;},
  async updateCertificate(id,b){id=Number(id);const c=db.certificates.find(x=>x.id===id);if(!c)throw new Error('Certificate not found');
    // Only overwrite what the form actually carried. A form that has no field
    // for holder_name must not be able to erase it — which is exactly what a
    // wholesale Object.assign did to every sponsor certificate.
    const row=certFromBody(b,c);if(!row.cert_number)throw new Error('Certificate # is required');
    Object.assign(c,row,{updated_at:nowISO()});await persist();return c;},
  async deleteCertificate(id){id=Number(id);db.certificates=db.certificates.filter(x=>x.id!==id);await persist();return{ok:true};},
  // Re-assign every certificate number for an offering by funding-date order.
  async renumberCertificates(offeringId){offeringId=Number(offeringId);
    const certs=db.certificates.filter(c=>c.offering_id===offeringId);
    certs.sort((a,b)=>{const fa=a.funded_date||a.issue_date||'',fb=b.funded_date||b.issue_date||'';
      if(fa!==fb)return fa.localeCompare(fb);return (a.sort_index||0)-(b.sort_index||0)||a.id-b.id;});
    const o=db.offerings.find(x=>x.id===offeringId);
    certs.forEach((c,idx)=>{c.cert_number=formatCertNumber(o||offeringId,idx+1);c.sort_index=idx+1;});
    await persist();return{ok:true};},

  /* ---- Firm settings ---------------------------------------------------- */
  async getSettings(){return settings();},
  async saveSettings(b){
    const cur=settings();
    const row={
      firm_name:str(b.firm_name),firm_address:str(b.firm_address),firm_contact:str(b.firm_contact),
      report_footer:str(b.report_footer)||DEFAULT_REPORT_FOOTER,
      default_exemption:str(b.default_exemption),default_security_type:str(b.default_security_type),
      default_return_rate:numOr(b.default_return_rate),
      default_costs_label:str(b.default_costs_label),
      default_min_investment_cents:dollarsToCents(b.default_min_investment),
      default_escrow_party_id:numOr(b.default_escrow_party_id),
      automation:b.automation==='off'?'off':'propose',
      mask_account_numbers:b.mask_account_numbers?1:0,
      date_defaults:b.date_defaults?1:0,
      default_accrual_convention:ACCRUAL_BY_VALUE.has(str(b.default_accrual_convention))
        ?str(b.default_accrual_convention):'simple/365',
      default_cert_number_format:{prefix:str(b.default_cert_prefix)||'',
        pad:Math.max(1,Math.min(8,numOr(b.default_cert_pad,1)||1))},
      // Not on any form: carried forward so a settings save never resets them.
      file_prompt_answered:cur.file_prompt_answered,last_copy_at:cur.last_copy_at,
      checklist_template:Array.isArray(b.checklist_template)?b.checklist_template:cur.checklist_template};
    db.settings={...db.settings,...row};await persist();return settings();},

  /* ---- Distributions ------------------------------------------------------
     Money paid out to holders after a closing. Nothing here touches escrow:
     escrow is where money sits before a closing, and this is all after one. */
  async listDistributions(offeringId){offeringId=Number(offeringId);
    const rows=db.distributions.filter(d=>d.offering_id===offeringId)
      .sort((a,b)=>String(b.pay_date||'').localeCompare(String(a.pay_date||''))||b.id-a.id);
    const total=rows.reduce((a,d)=>a+(d.amount_cents||0),0);
    const pref=rows.reduce((a,d)=>a+(d.allocations||[]).reduce((n,x)=>n+(x.pref_cents||0),0),0);
    const capital=rows.reduce((a,d)=>a+(d.allocations||[]).reduce((n,x)=>n+(x.capital_cents||0),0),0);
    return{distributions:rows.map(d=>({...d,
      allocations:(d.allocations||[]).map(a=>{
        const c=db.certificates.find(x=>x.id===a.certificate_id);
        const i=db.investors.find(x=>x.id===a.investor_id);
        return{...a,cert_number:c?c.cert_number:null,
          holder:i?investorDisplayName(i):(c&&c.holder_name)||'—'};})})),
      total,pref,capital};},
  async createDistribution(offeringId,b){offeringId=Number(offeringId);
    if(!db.offerings.find(x=>x.id===offeringId))throw new Error('Offering not found');
    const amount=Math.abs(dollarsToCents(b.amount)||0);
    if(!amount)throw new Error('Enter the amount being distributed.');
    const allocations=(Array.isArray(b.allocations)?b.allocations:[])
      .map(a=>({certificate_id:Number(a.certificate_id),investor_id:a.investor_id==null?null:Number(a.investor_id),
        pref_cents:Math.max(0,Number(a.pref_cents)||0),capital_cents:Math.max(0,Number(a.capital_cents)||0)}))
      .filter(a=>a.pref_cents||a.capital_cents);
    const allocated=allocations.reduce((n,a)=>n+a.pref_cents+a.capital_cents,0);
    // A distribution whose parts do not come to the cheque is a distribution
    // somebody has to explain. Refuse it rather than record it.
    if(allocated!==amount)
      throw new Error(`The allocations come to ${money(allocated)} against ${money(amount)} distributed. They must agree before this can be recorded.`);
    const row={id:nextId('distributions'),offering_id:offeringId,
      label:str(b.label)||`Distribution ${db.distributions.filter(d=>d.offering_id===offeringId).length+1}`,
      pay_date:str(b.pay_date)||todayISO(),amount_cents:amount,basis:str(b.basis)||'pref-first',
      method:str(b.method),reference:str(b.reference),notes:str(b.notes),
      allocations,created_at:nowISO()};
    db.distributions.push(row);await persist();return row;},
  async deleteDistribution(id){id=Number(id);
    db.distributions=db.distributions.filter(d=>d.id!==id);await persist();return{ok:true};},
  proposeDistribution(offeringId,amountCents,basis,asOf){
    return proposeDistribution(Number(offeringId),amountCents,basis,asOf);},

  /* ---- Transfers and redemptions ------------------------------------------
     The chain of title. A certificate is never rewritten in place: it is
     cancelled, and a successor is issued pointing back at it. */
  async listTransfers(offeringId){offeringId=Number(offeringId);
    return db.transfers.filter(t=>t.offering_id===offeringId)
      .sort((a,b)=>String(b.transfer_date||'').localeCompare(String(a.transfer_date||''))||b.id-a.id)
      .map(t=>{
        const from=db.certificates.find(c=>c.id===t.from_certificate_id);
        const to=db.certificates.find(c=>c.id===t.to_certificate_id);
        const holder=c=>{if(!c)return null;const i=db.investors.find(x=>x.id===c.investor_id);
          return i?investorDisplayName(i):(c.holder_name||'—');};
        return{...t,from_number:from?from.cert_number:null,to_number:to?to.cert_number:null,
          from_holder:holder(from),to_holder:holder(to)};});},
  async createTransfer(offeringId,b){offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);
    if(!o)throw new Error('Offering not found');
    const from=db.certificates.find(c=>c.id===Number(b.from_certificate_id)&&c.offering_id===offeringId);
    if(!from)throw new Error('Pick the certificate being transferred.');
    if(from.cancelled_date)throw new Error(`Certificate ${from.cert_number} has already been transferred or redeemed.`);
    const kind=b.kind==='redemption'?'redemption':'transfer';
    const date=str(b.transfer_date)||todayISO();
    const whole=b.whole!==false;
    const capital=from.capital_cents||0;
    const moving=whole?capital:Math.min(capital,Math.abs(dollarsToCents(b.capital)||0));
    if(!whole&&!moving)throw new Error('Enter how much capital is moving.');
    if(kind==='transfer'&&!b.to_investor_id&&!str(b.to_holder_name))
      throw new Error('Say who it is transferring to.');
    const transfer={id:nextId('transfers'),offering_id:offeringId,kind,
      from_certificate_id:from.id,to_certificate_id:null,
      to_investor_id:numOr(b.to_investor_id),to_holder_name:str(b.to_holder_name),
      transfer_date:date,capital_cents:moving,whole:whole?1:0,
      consideration_cents:dollarsToCents(b.consideration),
      notes:str(b.notes),created_at:nowISO()};

    if(whole){
      // The whole holding moves: the certificate is cancelled outright.
      from.cancelled_date=date;
      from.cancelled_by_transfer_id=transfer.id;
    }else{
      // Part of it moves: what is left stays on the original certificate.
      from.capital_cents=capital-moving;
    }
    if(kind==='transfer'){
      const maxSort=db.certificates.filter(c=>c.offering_id===offeringId)
        .reduce((m,c)=>Math.max(m,c.sort_index||0),0);
      const successor={id:nextId('certificates'),offering_id:offeringId,
        subscription_id:from.subscription_id??null,closing_id:from.closing_id??null,
        investor_id:numOr(b.to_investor_id),holder_name:str(b.to_holder_name),
        class_name:from.class_name,capital_cents:moving,
        pct_of_class:null,percent_interest:null,
        pref_return_rate:from.pref_return_rate,accrued_cents:null,
        // The successor takes the transferor's accrual start and convention:
        // a transfer moves a holding, it does not restart one.
        accrual_convention:from.accrual_convention||null,
        accrual_start:from.accrual_start||from.issue_date||null,
        funded_date:from.funded_date||null,
        issue_date:date,issued_by_transfer_date:date,
        cert_number:nextCertNumber(offeringId),sort_index:maxSort+1,
        no_capital:from.no_capital?1:0,
        transferred_from_certificate_id:from.id,
        notes:`Issued on the ${whole?'transfer':'part transfer'} of certificate ${from.cert_number}.`,
        created_at:nowISO()};
      db.certificates.push(successor);
      transfer.to_certificate_id=successor.id;
    }
    db.transfers.push(transfer);await persist();return transfer;},
  async deleteTransfer(id){id=Number(id);
    const t=db.transfers.find(x=>x.id===id);
    if(!t)throw new Error('Transfer not found');
    const from=db.certificates.find(c=>c.id===t.from_certificate_id);
    if(from){
      if(t.whole){from.cancelled_date=null;from.cancelled_by_transfer_id=null;}
      // A part transfer took capital off the original; give it back.
      else from.capital_cents=(from.capital_cents||0)+(t.capital_cents||0);
    }
    if(t.to_certificate_id)db.certificates=db.certificates.filter(c=>c.id!==t.to_certificate_id);
    db.transfers=db.transfers.filter(x=>x.id!==id);
    await persist();return{ok:true};},

  /* ---- Capital calls ------------------------------------------------------ */
  async listCapitalCalls(offeringId){offeringId=Number(offeringId);
    const calls=db.capital_calls.filter(c=>c.offering_id===offeringId)
      .sort((a,b)=>String(a.call_date||'').localeCompare(String(b.call_date||''))||a.id-b.id);
    return{calls:calls.map(c=>({...c,
      called:(c.allocations||[]).reduce((a,x)=>a+(x.amount_cents||0),0),
      allocations:(c.allocations||[]).map(a=>{
        const i=db.investors.find(x=>x.id===a.investor_id);
        return{...a,holder:i?investorDisplayName(i):'—'};})})),
      committed:db.subscriptions.filter(s=>s.offering_id===offeringId&&s.status!=='Withdrawn')
        .reduce((a,s)=>a+(s.amount_committed_cents||0),0)};},
  proposeCall(offeringId,percent){return proposeCall(offeringId,percent);},
  async createCapitalCall(offeringId,b){offeringId=Number(offeringId);
    if(!db.offerings.find(x=>x.id===offeringId))throw new Error('Offering not found');
    const allocations=(Array.isArray(b.allocations)?b.allocations:[])
      .map(a=>({subscription_id:Number(a.subscription_id),investor_id:a.investor_id==null?null:Number(a.investor_id),
        amount_cents:Math.max(0,Number(a.amount_cents)||0)}))
      .filter(a=>a.amount_cents);
    if(!allocations.length)throw new Error('This call asks nobody for anything.');
    const row={id:nextId('capital_calls'),offering_id:offeringId,
      label:str(b.label)||`Call ${db.capital_calls.filter(c=>c.offering_id===offeringId).length+1}`,
      call_date:str(b.call_date)||todayISO(),due_date:str(b.due_date),
      percent:numOr(b.percent),notes:str(b.notes),allocations,created_at:nowISO()};
    db.capital_calls.push(row);await persist();return row;},
  async deleteCapitalCall(id){id=Number(id);
    db.capital_calls=db.capital_calls.filter(c=>c.id!==id);await persist();return{ok:true};},

  /* ---- The offering that did not reach its minimum ------------------------
     Both facts needed for the escrow break were already tracked. What came
     next was a long stretch of manual ledger entry, undertaken at the one
     moment when everybody involved is under pressure and least able to check
     the arithmetic. This proposes the whole reversal, itemised, and writes
     nothing until it is accepted. */
  proposeBreak(offeringId){
    offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);
    if(!o)throw new Error('Offering not found');
    const s=offeringSummary(o);
    const subs=db.subscriptions.filter(x=>x.offering_id===offeringId&&x.status!=='Withdrawn');
    const refunds=[];
    for(const sub of subs){
      const e=investorEscrow(offeringId,sub.investor_id,sub.id);
      const held=e.clearedNet;
      if(held>0){const inv=db.investors.find(i=>i.id===sub.investor_id);
        refunds.push({subscription_id:sub.id,investor_id:sub.investor_id,
          holder:inv?investorDisplayName(inv):'—',amount_cents:held});}
    }
    return{offering:o,
      minRaise:o.target_min_cents,cleared:s.escrow.clearedNetDeposits,
      minRaiseMet:s.minRaiseMet,deadline:o.final_close_date,
      daysPastDeadline:o.final_close_date?-daysUntil(o.final_close_date):null,
      refunds,
      totalRefund:refunds.reduce((a,r)=>a+r.amount_cents,0),
      subscriptions:subs.length,
      // Closings already held mean money has left escrow to the issuer. That
      // is not a break, and this is not the tool for it.
      closingsHeld:db.closings.filter(c=>c.offering_id===offeringId).length};},
  async breakOffering(offeringId,b){offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);
    if(!o)throw new Error('Offering not found');
    const plan=api.proposeBreak(offeringId);
    if(plan.closingsHeld)throw new Error('This offering has already held a closing, so funds have left escrow. Undo the closing first if it should not stand.');
    const date=str(b&&b.refund_date)||todayISO();
    for(const r of plan.refunds){
      db.escrow.push({id:nextId('escrow'),offering_id:offeringId,investor_id:r.investor_id,
        subscription_id:r.subscription_id,txn_type:'refund',amount_cents:r.amount_cents,
        txn_date:date,method:null,reference:str(b&&b.reference)||null,cleared:1,
        notes:'Refunded — the minimum raise was not met.',source:'break',created_at:nowISO()});
      const sub=db.subscriptions.find(x=>x.id===r.subscription_id);
      if(sub){sub.status='Withdrawn';sub.updated_at=nowISO();}
    }
    // Subscribers who never funded are withdrawn too: the offering is over.
    for(const sub of db.subscriptions.filter(x=>x.offering_id===offeringId&&x.status!=='Withdrawn')){
      sub.status='Withdrawn';sub.updated_at=nowISO();
    }
    o.status='Terminated';o.updated_at=nowISO();
    await persist();
    return{refunded:plan.refunds.length,total:plan.totalRefund};},

  /* ---- Filings ------------------------------------------------------------
     Form D's position is computed rather than stored; the state notices are
     rows, because each one has its own date, fee and confirmation number. */
  async listFilings(offeringId){offeringId=Number(offeringId);
    const o=db.offerings.find(x=>x.id===offeringId);
    if(!o)throw new Error('Offering not found');
    const play=statesInPlay(offeringId);
    const rows=stateFilings(offeringId).map(f=>({...f,
      holders:(play.get(f.state)||[]).map(x=>x.investor?investorDisplayName(x.investor):'—'),
      // A row for a state nobody is in any more is not wrong, but it is worth
      // saying so rather than leaving it looking outstanding.
      inPlay:play.has(f.state)}));
    const known=new Set(rows.map(r=>r.state));
    return{formD:formDPosition(o),
      states:rows,
      // States the roster puts in play that have no row at all.
      missing:[...play.keys()].filter(c=>!known.has(c)).sort()
        .map(c=>({state:c,holders:(play.get(c)||[]).map(x=>x.investor?investorDisplayName(x.investor):'—')})),
      // Subscribers with no state recorded, who could be hiding a filing.
      unplaced:db.subscriptions.filter(s=>s.offering_id===offeringId&&s.status!=='Withdrawn')
        .map(s=>db.investors.find(i=>i.id===s.investor_id)).filter(i=>i&&!investorState(i))
        .map(i=>investorDisplayName(i))};},
  async saveStateFiling(offeringId,b,id){offeringId=Number(offeringId);
    const state=(str(b.state)||'').toUpperCase();
    if(!US_STATES.includes(state))throw new Error('Pick a state.');
    const row={state,filed_date:str(b.filed_date),fee_cents:dollarsToCents(b.fee),
      confirmation:str(b.confirmation),notes:str(b.notes)};
    if(id){const f=db.state_filings.find(x=>x.id===Number(id));
      if(!f)throw new Error('Filing not found');
      // One row per state per offering, or the outstanding list double-counts.
      if(db.state_filings.some(x=>x.offering_id===offeringId&&x.state===state&&x.id!==Number(id)))
        throw new Error(`${stateName(state)} already has a row on this offering.`);
      Object.assign(f,row);await persist();return f;}
    if(db.state_filings.some(x=>x.offering_id===offeringId&&x.state===state))
      throw new Error(`${stateName(state)} already has a row on this offering.`);
    const f={id:nextId('state_filings'),offering_id:offeringId,...row,created_at:nowISO()};
    db.state_filings.push(f);await persist();return f;},
  async deleteStateFiling(id){id=Number(id);
    db.state_filings=db.state_filings.filter(f=>f.id!==id);await persist();return{ok:true};},

  /* ---- Party directory -------------------------------------------------- */
  // Issuers, escrow agents, counsel. Entered once; picked everywhere after.
  async listParties(role){return role?partiesByRole(role):db.parties.slice().sort((a,b)=>
    String(a.role||'').localeCompare(String(b.role||''))||String(a.name||'').localeCompare(String(b.name||'')));},
  async saveParty(b,id){
    const row=partyFromBody(b);
    if(!row.name)throw new Error('A name is required.');
    if(id){const e=partyById(id);if(!e)throw new Error('Party not found');
      Object.assign(e,row,{updated_at:nowISO()});await persist();return e;}
    const e={id:nextId('parties'),...row,created_at:nowISO(),updated_at:nowISO()};
    db.parties.push(e);await persist();return e;},
  async deleteParty(id){id=Number(id);
    const used=db.offerings.filter(o=>o.issuer_party_id===id||o.escrow_party_id===id);
    if(used.length)throw new Error(`${used.length} offering${used.length===1?' still refers':'s still refer'} to this party. Change ${used.length===1?'it':'them'} first.`);
    db.parties=db.parties.filter(x=>x.id!==id);await persist();return{ok:true};},

  /* ---- Suggestions ------------------------------------------------------ */
  // Reading is free of side effects; only accept() writes, and only when
  // somebody presses the button.
  async listSuggestions(offeringId){return computeSuggestions(offeringId);},
  async acceptSuggestion(s){
    if(!s||typeof s.apply!=='function')throw new Error('This one has nothing to apply — it needs a decision from you.');
    await s.apply();
    logActivity('accepted',s.title,s.offeringId,s.key);
    await persist();return{ok:true};},
  async dismissSuggestion(s){
    if(!db.dismissed)db.dismissed={};
    db.dismissed[s.key]=nowISO();
    logActivity('dismissed',s.title,s.offeringId,s.key);
    await persist();return{ok:true};},
  async restoreDismissed(){db.dismissed={};await persist();return{ok:true};},
  async listActivity(offeringId,limit=40){
    const rows=db.activity.filter(a=>offeringId==null||a.offering_id===Number(offeringId));
    return rows.slice(-limit).reverse();},

  /* Passphrase protection. Setting one re-seals everything the app writes from
     the next save onward; the copies already on disk stay as they were until
     they are overwritten, which is why the UI says to save a fresh copy. */
  async setPassphrase(passphrase){
    if(!ENC_AVAILABLE)throw new Error('This browser does not offer the cryptography this needs.');
    if(!passphrase||passphrase.length<8)throw new Error('Use at least eight characters. This is the only thing standing between the file and whoever holds it.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    cryptoKey=await deriveKey(passphrase,salt,ENC_ITERATIONS);
    cryptoSalt=salt;cryptoIterations=ENC_ITERATIONS;
    logActivity('changed','Protected this data with a passphrase',null);
    await persist();return{ok:true};},
  async clearPassphrase(){
    cryptoKey=null;cryptoSalt=null;
    logActivity('changed','Removed the passphrase from this data',null);
    await persist();return{ok:true};},
  isProtected(){return isProtected();},

  /* Generations — the states this document passed through before the current
     one. Held in this browser, so not a backup; but the state before a wrong
     edit is exactly what a single-copy file cannot otherwise give back. */
  async listGenerations(){return ((await idbGet('generations'))||[]).slice().reverse();},
  async restoreGeneration(at){
    const text=await idbGet('gen:'+at);
    if(!text)throw new Error('That version is no longer held.');
    // Generations are held exactly as they were written, so a protected
    // document's earlier states are protected too and need unlocking.
    const parsed=await readDocument(text,'That saved version');
    // Restoring is itself an act worth being able to take back.
    captureUndo(`restoring the version saved at ${fmtDateTime(at)}`);
    const rev=Number(db.meta.rev)||0;
    adoptDocument(parsed);
    db.meta.rev=rev;
    logActivity('restored',`Restored the version saved at ${fmtDateTime(at)}`,null);
    await persist();return{ok:true};},
};

