/* ============================================================================
   SUGGESTIONS — the record proposes what it can already prove.

   Nothing here writes anything. computeSuggestions returns descriptions of
   changes; a change happens only when a person presses Accept. That is a
   deliberate choice: this is a securities file, and a figure nobody assented
   to is worse than a figure typed twice.
   ========================================================================== */

// Checklist steps whose completion the record itself can evidence. The key is
// stored on the task as `proves`, so a renamed step keeps its proof and a
// hand-written step never acquires one.
const TASK_PROOFS={
  form_d:o=>o.form_d_filed_date&&`Form D is recorded as filed on ${fmtDate(o.form_d_filed_date)}.`,
  escrow_setup:o=>(o.escrow_agent||o.escrow_bank)&&`Escrow is recorded with ${[o.escrow_agent,o.escrow_bank].filter(Boolean).join(' at ')}.`,
  docs_sent:o=>{const s=db.subscriptions.filter(x=>x.offering_id===o.id&&x.status!=='Withdrawn');
    return s.length&&s.every(x=>x.sub_sent_date)&&`All ${s.length} subscription agreement${s.length===1?' has':'s have'} a sent date.`;},
  subs_collected:o=>{const s=db.subscriptions.filter(x=>x.offering_id===o.id&&x.status!=='Withdrawn');
    return s.length&&s.every(x=>x.sub_signed_date)&&`All ${s.length} subscription agreement${s.length===1?' is':'s are'} signed.`;},
  accreditation:o=>{const ids=[...new Set(db.subscriptions.filter(x=>x.offering_id===o.id&&x.status!=='Withdrawn').map(x=>x.investor_id))];
    const inv=ids.map(id=>db.investors.find(i=>i.id===id)).filter(Boolean);
    return inv.length&&inv.every(i=>i.accredited_status==='Verified')&&`All ${inv.length} subscriber${inv.length===1?' is':'s are'} verified accredited.`;},
  min_raise:o=>{const s=escrowSummary(o.id);
    return o.target_min_cents>0&&s.clearedNetDeposits>=o.target_min_cents&&
      `${money(s.clearedNetDeposits)} has cleared escrow against a ${money(o.target_min_cents)} minimum.`;},
  closing_held:o=>{const n=db.closings.filter(c=>c.offering_id===o.id).length;
    return n>0&&`${n} closing${n===1?' is':'s are'} on record.`;},
  escrow_released:o=>{const r=escrowSummary(o.id).releases;
    return r>0&&`${money(r)} has been released to the issuer.`;},
  blue_sky:o=>{const play=[...statesInPlay(o.id).keys()];
    if(!play.length)return false;
    const filed=new Set(stateFilings(o.id).filter(f=>f.filed_date).map(f=>f.state));
    return play.every(c=>filed.has(c))&&
      `Notice filings are recorded for every state on the roster: ${play.map(stateName).join(', ')}.`;}
};
// Which default step proves which. Index-aligned with DEFAULT_CHECKLIST.
const DEFAULT_CHECKLIST_PROOFS={
  'Blue sky / state notice filings':'blue_sky',
  'Set up escrow account with escrow agent':'escrow_setup',
  'File Form D with the SEC':'form_d',
  'Distribute offering documents to investors':'docs_sent',
  'Collect signed subscription agreements':'subs_collected',
  'Verify accredited-investor status':'accreditation',
  'Confirm minimum raise satisfied':'min_raise',
  'Hold closing':'closing_held',
  'Release escrow funds to issuer':'escrow_released'
};

/* ---- Due dates the record already implies --------------------------------
   Checklist dates were typed by hand, while the deadlines that actually
   matter are all computable: Form D runs fifteen days from the first sale,
   the state notices run from the same date, and everything that must happen
   before a closing is due by the final close deadline.

   A step whose date the offering already implies should arrive carrying it,
   in the same way its completion is already proved by the record. Where a
   date has been typed, it stands — this only ever fills a blank. */
const CHECKLIST_DUE={
  form_d:o=>{const f=formDPosition(o);return f&&f.due?[f.due,`fifteen days after the first sale on ${fmtDate(f.firstSale)}`]:null;},
  blue_sky:o=>{const f=formDPosition(o);return f&&f.due?[f.due,'the state notices run from the first sale, as the Form D does']:null;},
  min_raise:o=>o.final_close_date?[o.final_close_date,'the final close deadline']:null,
  closing_held:o=>o.first_close_date?[o.first_close_date,'the first / interim close date']
    :(o.final_close_date?[o.final_close_date,'the final close deadline']:null),
  escrow_released:o=>o.first_close_date?[o.first_close_date,'the first / interim close date']:null,
  subs_collected:o=>o.first_close_date?[o.first_close_date,'the first / interim close date']:null,
  accreditation:o=>o.first_close_date?[o.first_close_date,'the first / interim close date']:null,
  escrow_setup:o=>o.launch_date?[o.launch_date,'the launch date']:null,
  docs_sent:o=>o.launch_date?[o.launch_date,'the launch date']:null,
};
// The proof key a step answers to, whether it came from the standard list or
// was written by hand.
function taskProof(t){return t.proves||DEFAULT_CHECKLIST_PROOFS[t.label]||null;}
function impliedDue(o,t){
  const key=taskProof(t);
  const fn=key&&CHECKLIST_DUE[key];
  return fn?fn(o):null;
}

/* A suggestion:
   {key, kind, offeringId, title, detail, evidence, severity, apply}
   `key` is stable for the same fact and changes when the fact changes, so a
   dismissal sticks but a changed circumstance comes back. */
function sugg(key,offeringId,title,detail,evidence,apply,severity='info'){
  return{key,offeringId:offeringId??null,title,detail,evidence,apply,severity};
}
function dismissed(key){return!!(db.dismissed&&db.dismissed[key]);}

function computeSuggestions(offeringId){
  const out=[];
  if(settings().automation!=='propose')return out;
  const only=offeringId==null?null:Number(offeringId);
  const offerings=only==null?db.offerings:db.offerings.filter(o=>o.id===only);

  for(const o of offerings){
    const subs=db.subscriptions.filter(s=>s.offering_id===o.id);
    const tasks=db.tasks.filter(t=>t.offering_id===o.id);
    const es=escrowSummary(o.id);

    /* ── The exemption ─────────────────────────────────────────────────────
       These read facts already in the file and say where they put the
       offering. Nothing here files anything or gives advice; each one names
       the fact it came from, and the ones with no `apply` are saying
       something that needs a decision rather than a keystroke. */

    // Form D. The app has always known the date of first sale and never once
    // mentioned that a filing falls due fifteen days after it.
    const fd=formDPosition(o);
    if(fd&&fd.firstSale&&!fd.filed){
      const late=fd.daysLeft<0;
      out.push(sugg(`formd-due:${o.id}:${fd.due}`,o.id,
        late?`Form D on ${o.name} was due ${fmtDate(fd.due)}`
            :`Form D on ${o.name} is due ${fmtDate(fd.due)}`,
        `First sale is ${fmtDate(fd.firstSale)}, taken from ${fd.from}. Rule 503 gives fifteen days from there, which ${late?'ran out':'runs out'} on ${fmtDate(fd.due)}. Record the filing date on the offering once it is filed.`,
        relDays(fd.daysLeft),null,late?'warn':'info'));
    }
    // The annual amendment, while the offering continues.
    if(fd&&fd.amendmentDue&&fd.amendmentDaysLeft!==null&&fd.amendmentDaysLeft<=30){
      out.push(sugg(`formd-amend:${o.id}:${fd.amendmentDue}`,o.id,
        `The Form D amendment on ${o.name} falls due ${fmtDate(fd.amendmentDue)}`,
        `The last filing recorded is ${fmtDate(fd.filed)} and the offering is still ${o.status}. An amendment falls due on or before the anniversary while it continues. Recording the new filing date here resets the year.`,
        relDays(fd.amendmentDaysLeft),null,fd.amendmentDaysLeft<0?'warn':'info'));
    }

    const standing=purchaserStanding(o.id);
    const is506b=o.exemption==='Reg D 506(b)';
    const is506c=o.exemption==='Reg D 506(c)';

    // 506(b): the thirty-five ceiling, and what the first non-accredited
    // purchaser brings with them.
    if(is506b&&standing.nonAccredited.length){
      const n=standing.nonAccredited.length;
      if(n>RULE_506B_LIMIT){
        out.push(sugg(`506b-over:${o.id}:${n}`,o.id,
          `${o.name} has ${n} non-accredited purchasers`,
          `Rule 506(b) allows no more than ${RULE_506B_LIMIT}. The exemption does not hold at ${n}, and the roster is the record of it.`,
          `${n} of ${RULE_506B_LIMIT}`,null,'warn'));
      }else if(n>=RULE_506B_LIMIT-5){
        out.push(sugg(`506b-near:${o.id}:${n}`,o.id,
          `${o.name} is ${RULE_506B_LIMIT-n} purchaser${RULE_506B_LIMIT-n===1?'':'s'} from the 506(b) ceiling`,
          `${n} of the ${RULE_506B_LIMIT} non-accredited purchasers Rule 506(b) allows are on the roster.`,
          `${n} of ${RULE_506B_LIMIT}`,null,'warn'));
      }
      out.push(sugg(`506b-info:${o.id}:${n}`,o.id,
        `${o.name} owes Rule 502(b) information to ${n} purchaser${n===1?'':'s'}`,
        `Admitting even one non-accredited purchaser under 506(b) brings the information-delivery requirement with it — the financial and non-financial disclosure the rule specifies, delivered a reasonable time before sale. The checklist has no step for it.`,
        standing.nonAccredited.map(r=>r.investor?investorDisplayName(r.investor):'—').slice(0,3).join(', ')
          +(n>3?` and ${n-3} more`:''),
        // The one thing the app can actually do about it: put the step on
        // this offering's checklist, where it will be seen again.
        async()=>{const label='Deliver Rule 502(b) information to non-accredited purchasers';
          if(db.tasks.some(t=>t.offering_id===o.id&&t.label===label))return;
          const max=db.tasks.filter(t=>t.offering_id===o.id).reduce((m,t)=>Math.max(m,t.sort_order||0),0);
          db.tasks.push({id:nextId('tasks'),offering_id:o.id,label,done:0,done_date:null,
            due_date:null,sort_order:max+1,created_at:nowISO()});
          await persist();},'warn'));
    }
    // 506(b) forbids general solicitation outright.
    if(is506b&&o.general_solicitation){
      out.push(sugg(`506b-solicit:${o.id}`,o.id,
        `${o.name} is marked as generally solicited under 506(b)`,
        'Rule 506(b) is unavailable where the offering is generally solicited or advertised. Either the flag is wrong, or the exemption is 506(c) — under which every purchaser must be verified.',
        o.exemption,null,'warn'));
    }
    // 506(c): self-certification is not enough, and that is the whole bargain.
    if(is506c){
      const short=[...standing.selfCertified,...standing.unestablished];
      if(short.length){
        out.push(sugg(`506c-verify:${o.id}:${short.length}`,o.id,
          `${short.length} purchaser${short.length===1?' on':'s on'} ${o.name} ${short.length===1?'is':'are'} not verified`,
          'Under 506(c) general solicitation is permitted because every purchaser is verified. Self-certification does not satisfy it, and neither does an unrecorded status. Record the verification, its basis and its date on each contact.',
          short.map(r=>r.investor?investorDisplayName(r.investor):'—').slice(0,3).join(', ')
            +(short.length>3?` and ${short.length-3} more`:''),
          null,'warn'));
      }
    }
    // Rule 506(d). Its absence from the file is the awkward part.
    if(/^Reg D 506/.test(String(o.exemption||''))&&!o.bad_actor_checked_date&&
       (subs.length||o.status!=='Drafting')){
      out.push(sugg(`bad-actor:${o.id}`,o.id,
        `No bad-actor inquiry is recorded for ${o.name}`,
        'Rule 506(d) disqualifies an offering where a covered person has a relevant order or conviction. The inquiry is routine; what is not routine is having no record that it was made. Edit the offering to record the date.',
        o.exemption,null,'warn'));
    }

    // Blue sky: which states the roster has put in play, and which of them
    // have no filing recorded.
    {
      const play=statesInPlay(o.id);
      const filed=new Set(stateFilings(o.id).filter(f=>f.filed_date).map(f=>f.state));
      const missing=[...play.keys()].filter(c=>!filed.has(c)).sort();
      if(missing.length){
        out.push(sugg(`blue-sky:${o.id}:${missing.join(',')}`,o.id,
          `${missing.length} state${missing.length===1?'' :'s'} on ${o.name} ${missing.length===1?'has':'have'} no notice filing recorded`,
          `Subscribers are resident in ${missing.map(stateName).join(', ')} and no filing is on record for ${missing.length===1?'it':'them'}. Most states want a notice within fifteen days of the first sale in the state, with a fee.`,
          missing.join(' · '),
          // Open a row per state, ready to be dated. Nothing is claimed as
          // filed — the rows are there to be filled in.
          async()=>{
            for(const code of missing){
              if(db.state_filings.some(f=>f.offering_id===o.id&&f.state===code))continue;
              db.state_filings.push({id:nextId('state_filings'),offering_id:o.id,state:code,
                filed_date:null,fee_cents:null,confirmation:null,notes:null,created_at:nowISO()});
            }
            await persist();},'warn'));
      }
    }

    /* -- Money that arrived, against the subscription it answers ----------- */
    for(const s of subs){
      if(s.status==='Withdrawn')continue;
      const inv=db.investors.find(i=>i.id===s.investor_id);
      const who=inv?investorDisplayName(inv):'This subscriber';
      const esc=investorEscrow(o.id,s.investor_id,s.id);
      const due=subscriptionDue(s,o);

      // A cleared deposit dates the funding. Do not make anyone retype it.
      if(esc.fundedDate&&s.funded_date!==esc.fundedDate){
        out.push(sugg(`funded-date:${s.id}:${esc.fundedDate}`,o.id,
          `Set ${who}'s funded date to ${fmtDate(esc.fundedDate)}`,
          s.funded_date?`The subscription records ${fmtDate(s.funded_date)}, but the earliest cleared deposit is ${fmtDate(esc.fundedDate)}. Certificate numbering runs off this date.`
            :'The deposit has cleared escrow, so the funding date is already on record. Certificate numbering runs off this date.',
          `${money(esc.clearedDeposits)} cleared escrow`,
          async()=>{s.funded_date=esc.fundedDate;if(SUB_STATUS_RANK[s.status]<SUB_STATUS_RANK.Funded)s.status='Funded';
            s.updated_at=nowISO();await persist();}));
      }

      // Funding recorded on the subscription but nothing in the escrow ledger.
      // An unattributed deposit of exactly this amount is very likely this
      // money, recorded without the investor — propose nothing rather than a
      // double entry the reconciliation would then chase.
      const unattributed=db.escrow.some(e=>e.offering_id===o.id&&e.txn_type==='deposit'&&!e.investor_id&&e.amount_cents===due);
      if(s.funded_date&&!esc.rows.length&&due>0&&!unattributed){
        out.push(sugg(`deposit-missing:${s.id}:${s.funded_date}:${due}`,o.id,
          `Record ${who}'s ${money(due)} deposit in the escrow ledger`,
          `The subscription is funded as at ${fmtDate(s.funded_date)}, but no deposit appears in the escrow ledger, so the cleared balance understates what was received.`,
          `${money(s.amount_committed_cents)} committed${o.pass_through_costs&&s.costs_cents?` · ${money(s.costs_cents)} costs`:''}`,
          async()=>{db.escrow.push({id:nextId('escrow'),offering_id:o.id,investor_id:s.investor_id,subscription_id:s.id,
            txn_type:'deposit',amount_cents:due,txn_date:s.funded_date,method:null,reference:null,cleared:1,
            notes:'Recorded from the subscription.',source:'proposed',created_at:nowISO()});await persist();},
          'warn'));
      }

      // The label has fallen behind the dates underneath it.
      const derived=derivedSubStatus(s);
      if(!s.closing_id&&derived!==s.status&&(SUB_STATUS_RANK[derived]??0)>(SUB_STATUS_RANK[s.status]??0)){
        out.push(sugg(`sub-status:${s.id}:${derived}`,o.id,
          `Move ${who} to “${derived}”`,
          `The subscription is marked “${s.status}”, but its own dates put it at “${derived}”. Signed and funded totals on the printed summary are scored from this.`,
          derived==='Funded'?`Funded ${fmtDate(s.funded_date)}`:derived==='Sub signed'?`Signed ${fmtDate(s.sub_signed_date)}`:derived==='Sub sent'?`Sent ${fmtDate(s.sub_sent_date)}`:'Linked to a closing',
          // Re-derived at the moment it runs: an earlier accepted change may
          // already have moved this subscription further on, and a label must
          // only ever advance.
          async()=>{const d=derivedSubStatus(s);
            if(s.status!=='Withdrawn'&&(SUB_STATUS_RANK[d]??0)>(SUB_STATUS_RANK[s.status]??0)){s.status=d;s.updated_at=nowISO();await persist();}}));
      }

      // Units and the amount disagree with the price they are both drawn from.
      const scope=scopeFor({offering:o,subscription:s});
      const du=derivedUnits(s,scope);
      if(du!=null&&s.units!=null&&Math.abs(Number(s.units)-du)>1e-6){
        out.push(sugg(`units:${s.id}:${du}`,o.id,
          `Set ${who}'s units to ${du}`,
          `${money(s.amount_committed_cents)} at ${money(inherited(scope,'price_per_unit_cents'))} a unit is ${du} units; the subscription records ${s.units}.`,
          `${s.units} recorded · ${du} implied`,
          async()=>{s.units=du;s.updated_at=nowISO();await persist();},'warn'));
      }
      if(du!=null&&s.units==null){
        out.push(sugg(`units-blank:${s.id}:${du}`,o.id,
          `Record ${du} units for ${who}`,
          `The amount and the unit price already determine this. Units appear on the roster and the printed summary.`,
          `${money(s.amount_committed_cents)} ÷ ${money(inherited(scope,'price_per_unit_cents'))}`,
          async()=>{s.units=du;s.updated_at=nowISO();await persist();}));
      }

      // Closed against a closing but still labelled otherwise.
      if(s.closing_id&&s.status!=='Closed'&&s.status!=='Withdrawn'){
        out.push(sugg(`closed-label:${s.id}`,o.id,
          `Mark ${who} closed`,
          'The subscription is linked to a closing but is not labelled Closed.','Linked to a closing',
          async()=>{s.status='Closed';s.updated_at=nowISO();await persist();}));
      }
    }

    /* -- Money in the ledger with no subscription behind it ---------------- */
    const subInvestors=new Set(subs.map(s=>s.investor_id));
    // Grouped per depositor: two wires from one investor are one subscriber
    // to add, not two subscriptions.
    const strays=new Map();
    for(const e of db.escrow.filter(x=>x.offering_id===o.id&&x.txn_type==='deposit'&&x.investor_id)){
      if(subInvestors.has(e.investor_id))continue;
      if(!strays.has(e.investor_id))strays.set(e.investor_id,[]);
      strays.get(e.investor_id).push(e);
    }
    for(const[invId,rows]of strays){
      const inv=db.investors.find(i=>i.id===invId);
      const total=rows.reduce((a,e)=>a+(Number(e.amount_cents)||0),0);
      const firstCleared=rows.filter(e=>e.cleared).map(e=>e.txn_date).filter(Boolean).sort()[0]||null;
      out.push(sugg(`sub-missing:${o.id}:${invId}:${total}`,o.id,
        `Add ${inv?investorDisplayName(inv):'this depositor'} to the offering`,
        `${rows.length===1?'A deposit is':rows.length+' deposits are'} recorded against someone who is not a subscriber on this offering, so the money sits in escrow against nothing.`,
        `${money(total)} deposited`,
        async()=>{
          // Re-checked at apply time: an earlier accept may already have
          // added this depositor.
          if(db.subscriptions.some(x=>x.offering_id===o.id&&x.investor_id===invId))return;
          const sub={id:nextId('subscriptions'),offering_id:o.id,investor_id:invId,
            amount_committed_cents:total,units:null,costs_cents:null,tranche_id:null,
            funded_date:firstCleared,status:firstCleared?'Funded':'Prospect',
            sub_sent_date:null,sub_signed_date:null,notes:'Created from the escrow ledger.',closing_id:null,
            source:'proposed',created_at:nowISO(),updated_at:nowISO()};
          db.subscriptions.push(sub);
          rows.forEach(e=>{if(e.subscription_id==null)e.subscription_id=sub.id;});
          await persist();},
        'warn'));
    }

    /* -- Checklist steps the record already evidences ---------------------- */
    for(const t of tasks){
      if(t.done)continue;
      const proofKey=t.proves||DEFAULT_CHECKLIST_PROOFS[t.label];
      if(!proofKey||!TASK_PROOFS[proofKey])continue;
      const proof=TASK_PROOFS[proofKey](o);
      if(!proof)continue;
      out.push(sugg(`task:${t.id}`,o.id,`Mark “${t.label}” complete`,proof,'Proved by the record',
        async()=>{t.done=1;t.done_date=todayISO();await persist();}));
    }
    // The converse: a step ticked whose date the offering never got.
    const formD=tasks.find(t=>(t.proves||DEFAULT_CHECKLIST_PROOFS[t.label])==='form_d');
    if(formD&&formD.done&&!o.form_d_filed_date&&formD.done_date){
      out.push(sugg(`formd-date:${o.id}:${formD.done_date}`,o.id,
        `Record the Form D filing date as ${fmtDate(formD.done_date)}`,
        'The checklist step is complete but the offering has no filing date, so the printed summary shows a dash where the filing should be.',
        'From the checklist',
        async()=>{o.form_d_filed_date=formD.done_date;o.updated_at=nowISO();await persist();}));
    }

    /* -- The offering's own labels ---------------------------------------- */
    const days=daysUntil(o.final_close_date);
    if(days!==null&&days<0&&!['Closed','Terminated'].includes(o.status)){
      out.push(sugg(`past-deadline:${o.id}:${o.final_close_date}`,o.id,
        `${o.name} is past its final close deadline`,
        `The deadline was ${fmtDate(o.final_close_date)} and the offering is still ${o.status}. Either extend the deadline or move the offering on.`,
        relDays(days),null,'warn'));
    }
    // The deadline passed and the minimum was never reached. This is the one
    // suggestion that proposes an ending rather than a correction, so it
    // carries no `apply` — it points at the screen that itemises it first.
    if(days!==null&&days<0&&o.target_min_cents&&!['Closed','Terminated'].includes(o.status)
       &&!db.closings.some(c=>c.offering_id===o.id)){
      const sum=offeringSummary(o);
      if(!sum.minRaiseMet){
        out.push(sugg(`break-escrow:${o.id}:${o.final_close_date}`,o.id,
          `${o.name} closed short of its minimum`,
          `${money(sum.escrow.clearedNetDeposits)} cleared against a ${money(o.target_min_cents)} minimum, and the deadline was ${fmtDate(o.final_close_date)}. Either the deadline moves, or escrow breaks: the Closings tab will itemise the refunds before writing any of them.`,
          `${money(o.target_min_cents-sum.escrow.clearedNetDeposits)} short`,null,'warn'));
      }
    }
    if(o.status==='Drafting'&&(subs.length||es.deposits)){
      out.push(sugg(`status-open:${o.id}`,o.id,`Move ${o.name} to Open`,
        'The offering is still marked Drafting although subscribers and escrow activity are on record.',
        `${subs.length} subscriber${subs.length===1?'':'s'}`,
        async()=>{o.status='Open';o.updated_at=nowISO();await persist();}));
    }

    /* -- Ownership classes ------------------------------------------------- */
    const classes=Array.isArray(o.classes)?o.classes:[];
    if(classes.length){
      const sum=classes.reduce((a,c)=>a+(Number(c.total_percent)||0),0);
      if(Math.abs(sum-100)>0.0001){
        out.push(sugg(`class-sum:${o.id}:${sum}`,o.id,'The ownership classes do not total 100%',
          `The defined classes come to ${fmtPct(sum)} of the company. Every certificate's total percentage is scaled from these, so the cap table is wrong until they balance.`,
          fmtPct(sum),null,'warn'));
      }
      // A class name that exists only on a certificate is almost always a typo.
      const known=new Set(classes.map(c=>c.name));
      const stray=[...new Set(db.certificates.filter(c=>c.offering_id===o.id&&c.class_name&&!known.has(c.class_name)).map(c=>c.class_name))];
      for(const name of stray){
        out.push(sugg(`stray-class:${o.id}:${name}`,o.id,`“${name}” is not one of this offering's classes`,
          'Certificates carry a class name that the class structure does not define, so their share is pro-rated outside the defined split.',
          [...known].join(' · ')||'no classes defined',null,'warn'));
      }
    }

    /* -- Certificates against their subscriptions -------------------------- */
    for(const c of db.certificates.filter(x=>x.offering_id===o.id)){
      if(c.no_capital||!c.investor_id)continue;
      // The certificate's own link first; else the investor's single live
      // subscription. Two live subscriptions is ambiguous — say nothing
      // rather than compare against the wrong one.
      let s=c.subscription_id?subs.find(x=>x.id===c.subscription_id):null;
      if(!s){const live=subs.filter(x=>x.investor_id===c.investor_id&&x.status!=='Withdrawn');
        if(live.length!==1)continue;s=live[0];}
      if(!s||s.amount_committed_cents==null||c.capital_cents==null)continue;
      if(c.capital_cents!==s.amount_committed_cents){
        const inv=db.investors.find(i=>i.id===c.investor_id);
        out.push(sugg(`cert-capital:${c.id}:${s.amount_committed_cents}`,o.id,
          `Certificate ${c.cert_number} disagrees with the subscription`,
          `The certificate records ${money(c.capital_cents)} of capital for ${inv?investorDisplayName(inv):'this holder'}; the subscription records ${money(s.amount_committed_cents)}. Percentage interests are computed from capital.`,
          `${money(c.capital_cents)} on the certificate`,
          async()=>{c.capital_cents=s.amount_committed_cents;await persist();},'warn'));
      }
    }

    /* -- Reconciliation ---------------------------------------------------- */
    const recs=db.reconciliations.filter(r=>r.offering_id===o.id)
      .sort((a,b)=>(b.statement_date||b.created_at||'').localeCompare(a.statement_date||a.created_at||''));
    if(recs[0]&&recs[0].difference_cents){
      out.push(sugg(`recon:${recs[0].id}`,o.id,'The last reconciliation did not agree',
        `The statement of ${fmtDate(recs[0].statement_date)} differs from the app's cleared balance by ${money(Math.abs(recs[0].difference_cents))}. Pending deposits that have since cleared are the usual cause.`,
        (recs[0].difference_cents>0?'+':'−')+money(Math.abs(recs[0].difference_cents)),null,'warn'));
    }
    // Deposits sitting pending long after their date.
    const stale=db.escrow.filter(e=>e.offering_id===o.id&&e.txn_type==='deposit'&&!e.cleared&&e.txn_date&&daysUntil(e.txn_date)<-10);
    if(stale.length){
      const total=stale.reduce((a,e)=>a+(e.amount_cents||0),0);
      out.push(sugg(`stale-pending:${o.id}:${stale.length}:${total}`,o.id,
        `${stale.length} deposit${stale.length===1?'':'s'} still pending after ten days`,
        'Pending deposits are excluded from the cleared balance, so the minimum raise reads low until they are marked cleared.',
        `${money(total)} pending`,null,'warn'));
    }
  }

  /* -- Contact book and directory (not tied to one offering) --------------- */
  if(only==null){
    for(const i of db.investors){
      if(i.accredited_status==='Verified'&&!i.accredited_verified_date){
        out.push(sugg(`acc-date:${i.id}`,null,`Record when ${investorDisplayName(i)}'s accreditation was verified`,
          'The investor is marked Verified with no verification date. The date is the part that evidences the exemption.',
          'Verified, undated',null));
      }
      // The status says whether; nothing said how, which is the half a file
      // is actually read for.
      if(i.accredited_status==='Verified'&&i.accredited_verified_date&&!i.accreditation_basis){
        out.push(sugg(`acc-basis:${i.id}`,null,`Record how ${investorDisplayName(i)}'s accreditation was established`,
          'Verified on a date, but the file does not say on what — income, net worth, a professional licence, a letter from counsel. The basis is what the evidence consists of.',
          `Verified ${fmtDate(i.accredited_verified_date)}`,null));
      }
      // Evidence goes stale. Not a rule in Reg D — a house standard, and said
      // as one rather than dressed up as the regulation.
      const stale=accreditationStaleness(i);
      if(stale){
        const live=db.subscriptions.some(s=>s.investor_id===i.id&&s.status!=='Withdrawn'&&!s.closing_id);
        if(live)out.push(sugg(`acc-stale:${i.id}:${i.accredited_evidence_date||i.accredited_verified_date}`,null,
          `${investorDisplayName(i)}'s accreditation evidence is ${stale} days old`,
          `The evidence relied on is dated ${fmtDate(i.accredited_evidence_date||i.accredited_verified_date)} and there is an open subscription. A firm taking ${ACCREDITATION_STALE_DAYS} days as its limit would re-verify before the next sale.`,
          `${stale} days`,null,'warn'));
      }
      // A holder with no state is a state notice filing nobody can see is due.
      if(!str(i.state)){
        const guess=investorState(i);
        const onDeals=db.subscriptions.some(s=>s.investor_id===i.id&&s.status!=='Withdrawn');
        if(guess&&onDeals)out.push(sugg(`inv-state:${i.id}:${guess}`,null,
          `Record ${investorDisplayName(i)} as resident in ${stateName(guess)}`,
          'The address ends in this state and the contact has no state recorded. State notice filings are worked out from this field, so a blank one hides a filing that may be due.',
          guess,
          async()=>{const inv=db.investors.find(x=>x.id===i.id);
            if(inv&&!str(inv.state)){inv.state=guess;inv.updated_at=nowISO();await persist();}}));
      }
    }
    // Two records for one person is the most expensive duplicate of all.
    const seen=new Map();
    for(const i of db.investors){
      for(const k of [i.email&&`e:${String(i.email).toLowerCase()}`,i.tax_id&&`t:${String(i.tax_id).replace(/\D/g,'')}`].filter(Boolean)){
        if(k==='t:')continue;
        if(seen.has(k)){
          const other=seen.get(k);
          out.push(sugg(`dup:${Math.min(other.id,i.id)}:${Math.max(other.id,i.id)}`,null,
            `${investorDisplayName(other)} and ${investorDisplayName(i)} share ${k.startsWith('e:')?'an email address':'a taxpayer ID'}`,
            'Two contact records for one holder split their subscriptions, their accreditation evidence and their certificates.',
            k.slice(2),null,'warn'));
        }else seen.set(k,i);
      }
    }
    if(!settings().firm_name&&db.offerings.length){
      out.push(sugg('settings-firm',null,'Set up your firm details',
        'The firm name, address and report footer appear on every printed summary, and the defaults you set there start every new offering.',
        'Entered once',null));
    }
  }

  return out.filter(s=>!dismissed(s.key));
}

