/* ============================================================================
   THE TRAIL — what changed, when, and what put it there.

   The trail used to record only what the app proposed and you accepted, which
   answers the easy half of the question. The hard half — "when did this figure
   change, and to what" — needs every edit and every deletion in it too.

   Every write goes through the API, so it is taken here rather than at forty
   call sites: one table, read alongside the methods it describes, instead of a
   logging line to forget inside each of them.
   ========================================================================== */
const oNameOf=id=>{const o=db.offerings.find(x=>x.id===Number(id));return o?o.name:'an offering';};
const iNameOf=id=>{const i=db.investors.find(x=>x.id===Number(id));return i?investorDisplayName(i):'an investor';};
const subWho=id=>{const s=db.subscriptions.find(x=>x.id===Number(id));return s?iNameOf(s.investor_id):'a subscriber';};
const subOff=id=>{const s=db.subscriptions.find(x=>x.id===Number(id));return s?s.offering_id:null;};

// name → (args) => [summary, offeringId] | null
// Evaluated BEFORE the call, while the record still holds what is about to be
// removed. Creations name themselves from the body they were handed.
const AUDIT={
  createOffering:b=>[`Created the offering “${str(b.name)||'untitled'}”`,null],
  updateOffering:(id,b)=>[`Edited the offering “${str(b.name)||oNameOf(id)}”`,Number(id)],
  deleteOffering:id=>[`Deleted the offering “${oNameOf(id)}” and everything recorded on it`,null],
  saveTranche:(offId,b,tid)=>[`${tid?'Edited':'Added'} the tranche “${str(b.name)||''}”`,Number(offId)],
  deleteTranche:(offId,tid)=>[`Deleted a tranche from “${oNameOf(offId)}”`,Number(offId)],
  saveClasses:(offId)=>[`Changed the ownership classes on “${oNameOf(offId)}”`,Number(offId)],

  createInvestor:b=>[`Added ${str(b.name)||[str(b.first_name),str(b.last_name)].filter(Boolean).join(' ')||'a contact'} to the contact book`,null],
  updateInvestor:id=>[`Edited the contact ${iNameOf(id)}`,null],
  deleteInvestor:id=>[`Deleted the contact ${iNameOf(id)}`,null],

  createSubscription:(offId,b)=>[`Added ${iNameOf(b.investor_id)} to “${oNameOf(offId)}”`,Number(offId)],
  updateSubscription:id=>[`Edited ${subWho(id)}'s subscription`,subOff(id)],
  deleteSubscription:id=>[`Removed ${subWho(id)} from the offering`,subOff(id)],

  createEscrow:(offId,b)=>[`Recorded a ${str(b.txn_type)||'escrow'} entry of ${money(dollarsToCents(b.amount))}`,Number(offId)],
  updateEscrow:id=>{const e=db.escrow.find(x=>x.id===Number(id));
    return[`Edited an escrow entry${e?` of ${money(e.amount_cents)}`:''}`,e?e.offering_id:null];},
  deleteEscrow:id=>{const e=db.escrow.find(x=>x.id===Number(id));
    return[`Deleted an escrow entry${e?` of ${money(e.amount_cents)}`:''}`,e?e.offering_id:null];},

  createTask:(offId,b)=>[`Added the checklist step “${str(b.label)||''}”`,Number(offId)],
  updateTask:(id,b)=>{const t=db.tasks.find(x=>x.id===Number(id));
    // Ticking a box is the commonest write in the app; say which way it went.
    const verb=b&&'done'in b?(b.done?'Completed':'Reopened'):'Edited';
    return[`${verb} the checklist step “${t?t.label:''}”`,t?t.offering_id:null];},
  deleteTask:id=>{const t=db.tasks.find(x=>x.id===Number(id));
    return[`Deleted the checklist step “${t?t.label:''}”`,t?t.offering_id:null];},

  createReconciliation:(offId,b)=>[`Reconciled “${oNameOf(offId)}” to a statement of ${money(dollarsToCents(b.statement_balance))}`,Number(offId)],
  deleteReconciliation:id=>{const r=db.reconciliations.find(x=>x.id===Number(id));
    return[`Deleted a reconciliation`,r?r.offering_id:null];},

  createClosing:(offId,b)=>[`Held a closing on “${oNameOf(offId)}”, releasing ${money(dollarsToCents(b.amount_released))}`,Number(offId)],
  deleteClosing:id=>{const c=db.closings.find(x=>x.id===Number(id));
    return[`Undid the closing “${c?c.label:''}” — its release, its certificates and its closed subscriptions`,c?c.offering_id:null];},

  createCertificate:(offId,b)=>[`Issued certificate ${str(b.cert_number)||''}`,Number(offId)],
  updateCertificate:id=>{const c=db.certificates.find(x=>x.id===Number(id));
    return[`Edited certificate ${c?c.cert_number:''}`,c?c.offering_id:null];},
  deleteCertificate:id=>{const c=db.certificates.find(x=>x.id===Number(id));
    return[`Deleted certificate ${c?c.cert_number:''}`,c?c.offering_id:null];},
  renumberCertificates:offId=>[`Renumbered the certificates on “${oNameOf(offId)}”`,Number(offId)],
  breakOffering:offId=>{const p=api.proposeBreak(offId);
    return[`Broke escrow on “${oNameOf(offId)}” — ${p.refunds.length} refund${p.refunds.length===1?'':'s'} totalling ${money(p.totalRefund)}, every subscription withdrawn, the offering terminated`,Number(offId)];},

  createDistribution:(offId,b)=>[`Recorded a distribution of ${money(dollarsToCents(b.amount))} on “${oNameOf(offId)}”`,Number(offId)],
  deleteDistribution:id=>{const d=db.distributions.find(x=>x.id===Number(id));
    return[`Deleted the distribution “${d?d.label:''}”`,d?d.offering_id:null];},
  createTransfer:(offId,b)=>{const c=db.certificates.find(x=>x.id===Number(b.from_certificate_id));
    return[`${b.kind==='redemption'?'Redeemed':'Transferred'} certificate ${c?c.cert_number:''}`,Number(offId)];},
  deleteTransfer:id=>{const t=db.transfers.find(x=>x.id===Number(id));
    const c=t&&db.certificates.find(x=>x.id===t.from_certificate_id);
    return[`Undid the ${t&&t.kind==='redemption'?'redemption':'transfer'} of certificate ${c?c.cert_number:''}`,t?t.offering_id:null];},
  createCapitalCall:(offId,b)=>[`Issued a capital call on “${oNameOf(offId)}”`,Number(offId)],
  deleteCapitalCall:id=>{const c=db.capital_calls.find(x=>x.id===Number(id));
    return[`Deleted the capital call “${c?c.label:''}”`,c?c.offering_id:null];},

  saveStateFiling:(offId,b,id)=>[`${id?'Edited':'Recorded'} the ${stateName((str(b.state)||'').toUpperCase())} notice filing`,Number(offId)],
  deleteStateFiling:id=>{const f=db.state_filings.find(x=>x.id===Number(id));
    return[`Deleted the ${f?stateName(f.state):''} notice filing`,f?f.offering_id:null];},

  saveSettings:()=>[`Changed the firm settings`,null],
  saveParty:(b,id)=>[`${id?'Edited':'Added'} ${str(b.name)||'a counterparty'} in the directory`,null],
  deleteParty:id=>{const p=db.parties.find(x=>x.id===Number(id));
    return[`Removed ${p?p.name:'a counterparty'} from the directory`,null];},
};
// acceptSuggestion / dismissSuggestion write their own, richer entries; the
// rest are reads. Named so the wrapper's completeness check stays honest.
// breakOffering reverses a whole offering; it is wrapped by name rather than
// by prefix, since "break" is not one of the verbs the loop looks for.
const AUDIT_EXTRA=new Set(['breakOffering']);
const AUDIT_EXEMPT=new Set(['acceptSuggestion','dismissSuggestion','restoreDismissed','unlockWithPassphrase','setPassphrase','clearPassphrase']);

// Actions the trail should carry but which do not pass through a single API
// method — accepting a whole strip of suggestions, restoring a generation.
function logChange(summary,offeringId){logActivity('changed',summary,offeringId??null);}

for(const name of Object.keys(api)){
  const fn=api[name];
  if(typeof fn!=='function')continue;
  if(!/^(create|update|delete|save|renumber|issue|record|cancel|reverse|refund)/.test(name)&&!AUDIT_EXTRA.has(name))continue;
  if(AUDIT_EXEMPT.has(name))continue;
  const describe=AUDIT[name];
  api[name]=async function(...args){
    // Described first: a deletion can only name what it removed while it is
    // still there. A describer that throws must never stop the write.
    let entry=null;
    if(describe){try{entry=describe(...args);}catch{entry=null;}}
    const out=await fn.apply(this,args);
    if(entry){logActivity('changed',entry[0],entry[1]??null);await persist();}
    // The first record is the moment the browser-only copy starts to matter.
    if(name.startsWith('create'))maybeOfferDataFile();
    return out;
  };
}

/* ---- Undo ----------------------------------------------------------------
   One level, and only over the acts that cannot otherwise be reversed by
   re-typing: the deletions that cascade. Enough to take back the click that
   was a mistake; not so much that the app starts claiming to be a history. */
let undoState=null;
function captureUndo(label){
  try{undoState={label,doc:JSON.parse(serialize()),at:Date.now()};}
  catch{undoState=null;}
}
async function undoLast(){
  if(!undoState)return false;
  const{doc,label}=undoState;undoState=null;
  // The revision must keep climbing across an undo, or the other-tab check
  // reads the restored document as the stale one.
  const rev=Number(db.meta.rev)||0;
  db=normalize(doc);
  db.meta.rev=rev;
  logActivity('undone',`Took back: ${label}`,null);
  await persist();refresh();
  toast('Taken back.','success');
  return true;
}
// Runs `act`, then offers to take it back for as long as the toast stands.
async function withUndo(label,act,doneMessage){
  captureUndo(label);
  await act();
  toast(doneMessage,'success',{label:'Undo',run:undoLast});
}

/* ---- Asking for a data file at the right moment --------------------------
   Until a file is connected the browser copy is the only copy — the default
   state for every new user, and the permanent state on an iPad. The welcome
   panel offers a file while the dashboard is empty, which is exactly when
   there is nothing to lose and no reason to say yes. So ask again at the first
   record, when the answer means something.

   A toast rather than a dialog, and the distinction matters: this fires on a
   create, and a create is very often made from inside an open form. A dialog
   would tear that form down mid-entry to ask a question about backups. It
   asks once a session, stops for good once a file is connected, and takes no
   answer for an answer. */
let fileNudged=false;
function maybeOfferDataFile(){
  if(fileNudged||fileHandle||pendingHandle||!FSA||readOnly)return;
  if(settings().file_prompt_answered)return;
  if(countRecords(db)<1)return;
  fileNudged=true;
  toast('This is held only inside this browser. Clearing browsing data would take it with it.','info',
    {label:'Store it in a file…',run:async()=>{
      db.settings={...db.settings,file_prompt_answered:1};
      await persist();
      await newDataFile();}});
}
// A copy that was never taken is not a backup. Said once per session, and only
// where the app cannot autosave to a file for you.
function backupStalenessNotice(){
  if(fileHandle||!hasData(db))return;
  const at=settings().last_copy_at;
  const days=at?Math.floor((Date.now()-new Date(at).getTime())/86400000):null;
  if(days!==null&&days<7)return;
  toast(days===null
    ?'No copy of this data has been saved yet. It exists in this browser and nowhere else.'
    :`The last copy of this data was saved ${days} days ago.`,
    'error',{label:'Save a copy now',run:downloadCopy});
}
// `existing` supplies the values for fields the form did not render, so an
// edit narrows to what was on screen rather than blanking the rest.
function certFromBody(b,existing){const e=existing||{};return{
  cert_number:str(b.cert_number),investor_id:numOr(b.investor_id),
  holder_name:'holder_name'in b?str(b.holder_name):(e.holder_name??null),
  class_name:str(b.class_name),capital_cents:b.no_capital?null:dollarsToCents(b.capital),
  // pct_of_class: optional manual override of the holder's share WITHIN its class.
  pct_of_class:numOr(b.pct_of_class),
  // percent_interest: optional manual override of TOTAL % ownership (else computed).
  percent_interest:numOr(b.percent_interest),
  pref_return_rate:numOr(b.pref_return_rate),
  // accrued_cents: optional manual override (else auto-computed to the as-of date).
  accrued_cents:dollarsToCents(b.accrued),
  // Written down on the certificate, so a convention changed on the offering
  // later never restates what this one was issued under.
  accrual_convention:'accrual_convention'in b?(str(b.accrual_convention)||null):(e.accrual_convention??null),
  funded_date:str(b.funded_date),
  accrual_start:'accrual_start'in b?str(b.accrual_start):(e.accrual_start??null),
  closing_id:'closing_id'in b?numOr(b.closing_id):(e.closing_id??null),
  subscription_id:'subscription_id'in b?numOr(b.subscription_id):(e.subscription_id??null),
  sort_index:numOr(b.sort_index),no_capital:b.no_capital?1:0,
  issue_date:str(b.issue_date),notes:str(b.notes)};}

