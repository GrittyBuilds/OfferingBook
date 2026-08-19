/* ============================================================================
   WHAT NEEDS ATTENTION

   The pieces existed and were scattered: upcoming closings on the dashboard,
   stale deposits and past deadlines inside the suggestion strip, overdue
   checklist steps nowhere at all. This gathers everything that carries a date
   across every offering, in date order — the screen a practice opens on a
   Monday morning.

   Nothing here is a suggestion: a suggestion proposes a change to the record,
   and these are simply things that fall due.
   ========================================================================== */
function attentionItems(){
  const out=[];
  const today=todayISO();
  const add=(date,kind,title,detail,offeringId)=>{
    if(!date)return;
    out.push({date,kind,title,detail,offeringId,days:daysUntil(date)});
  };
  for(const o of db.offerings){
    if(['Closed','Terminated'].includes(o.status))continue;
    const fd=formDPosition(o);
    if(fd&&fd.due&&!fd.filed)
      add(fd.due,'Form D',`File Form D on ${o.name}`,
        `Fifteen days from the first sale on ${fmtDate(fd.firstSale)}.`,o.id);
    if(fd&&fd.amendmentDue)
      add(fd.amendmentDue,'Form D',`Form D amendment on ${o.name}`,
        `A year from the filing recorded on ${fmtDate(fd.filed)}.`,o.id);
    if(o.final_close_date)
      add(o.final_close_date,'Closing',`${o.name} reaches its final close deadline`,
        (()=>{const s=offeringSummary(o);
          return s.minRaiseMet?'The minimum raise has been met.'
            :`${money(o.target_min_cents-s.escrow.clearedNetDeposits)} short of the minimum.`;})(),o.id);
    for(const t of db.tasks.filter(t=>t.offering_id===o.id&&!t.done)){
      const due=t.due_date?[t.due_date,'entered on the step']:impliedDue(o,t);
      if(due)add(due[0],'Checklist',`${t.label} — ${o.name}`,
        t.due_date?'From the checklist.':`Worked out from ${due[1]}.`,o.id);
    }
    for(const c of db.capital_calls.filter(c=>c.offering_id===o.id&&c.due_date))
      add(c.due_date,'Capital call',`${c.label} falls due on ${o.name}`,
        `${money((c.allocations||[]).reduce((a,x)=>a+(x.amount_cents||0),0))} called.`,o.id);
    // Deposits that have sat pending long enough to be worth chasing.
    const stale=db.escrow.filter(e=>e.offering_id===o.id&&e.txn_type==='deposit'&&!e.cleared
      &&e.txn_date&&daysUntil(e.txn_date)<-10);
    if(stale.length)add(stale.map(e=>e.txn_date).sort()[0],'Escrow',
      `${stale.length} deposit${stale.length===1?'':'s'} still pending on ${o.name}`,
      `${money(stale.reduce((a,e)=>a+(e.amount_cents||0),0))} is excluded from the cleared balance until it settles.`,o.id);
  }
  out.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return{items:out,today,
    overdue:out.filter(x=>x.days<0),
    soon:out.filter(x=>x.days>=0&&x.days<=14),
    later:out.filter(x=>x.days>14)};
}
function attentionPanel(){
  const{items,overdue,soon}=attentionItems();
  if(!items.length)return null;
  const shownItems=[...overdue,...soon];
  if(!shownItems.length)return null;
  const KIND_PILL={'Form D':'info','Closing':'warn','Checklist':'default','Capital call':'info','Escrow':'muted'};
  return el('section',{class:'panel attention'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Needs attention'),
        el('div',{class:'section-figures'},
          overdue.length?el('span',{class:'urgent-text'},el('strong',{},String(overdue.length)),' overdue'):null,
          soon.length?el('span',{},el('strong',{},String(soon.length)),' within a fortnight'):null))),
    el('ul',{class:'attention-list'},...shownItems.map(x=>
      el('li',{class:'attention-item'+(x.days<0?' overdue':''),tabindex:'0',role:'link',
        onclick:()=>x.offeringId&&navigate(`/offerings/${x.offeringId}`),
        onkeydown:e=>{if((e.key==='Enter'||e.key===' ')&&x.offeringId){e.preventDefault();navigate(`/offerings/${x.offeringId}`);}}},
        el('span',{class:'attention-when'},fmtDate(x.date),
          el('span',{class:'attention-rel'},relDays(x.days))),
        el('span',{class:'attention-main'},
          el('span',{class:'attention-title'},x.title),
          el('span',{class:'attention-detail'},x.detail)),
        pill(x.kind,KIND_PILL[x.kind]||'default')))));
}

