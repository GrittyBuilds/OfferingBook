/* ============================================================================
   THE HOLDER'S STATEMENT

   Everything a client statement needs was already assembled on the investor
   page — subscriptions across offerings, what was funded and when,
   certificates, accrued return — and there was no way to print it. This is
   the document a firm sends most often.
   ========================================================================== */
async function printInvestorStatement(investorId){
  try{
    const inv=await api.getInvestor(investorId);
    printDocument(()=>buildInvestorStatement(inv),{failure:'Could not build the statement'});
  }catch(e){toast('Could not build the statement: '+e.message,'error');}
}
function buildInvestorStatement(inv){
  const cfg=settings();
  const asOf=todayISO();
  const dName=investorDisplayName(inv);
  // Every certificate this holder holds, across every offering they are on.
  const holdings=[];
  for(const o of db.offerings){
    const r=computeCertificates(o.id,asOf);
    for(const c of r.certificates)
      if(c.investor_id===inv.id)holdings.push({offering:o,cert:c});
  }
  const paid=[];
  for(const d of db.distributions){
    const mine=(d.allocations||[]).filter(a=>a.investor_id===inv.id);
    if(!mine.length)continue;
    const o=db.offerings.find(x=>x.id===d.offering_id);
    paid.push({offering:o,dist:d,
      pref:mine.reduce((a,x)=>a+(x.pref_cents||0),0),
      capital:mine.reduce((a,x)=>a+(x.capital_cents||0),0)});
  }
  paid.sort((a,b)=>String(a.dist.pay_date||'').localeCompare(String(b.dist.pay_date||'')));
  const committed=inv.subscriptions.reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  const received=inv.subscriptions.reduce((a,s)=>a+Math.max(0,investorEscrow(s.offering_id,inv.id,s.id).clearedNet),0);
  const capital=holdings.reduce((a,h)=>a+(h.cert.capital_cents||0),0);
  const owed=holdings.reduce((a,h)=>a+(h.cert.accrued_outstanding||0),0);
  const paidTotal=paid.reduce((a,p)=>a+p.pref+p.capital,0);

  return el('div',{},
    el('div',{class:'report-lockup'},el('span',{html:REPORT_MARK}),el('span',{class:'rl-name'},'Muniment')),
    el('div',{class:'report-head'},
      el('div',{},el('h1',{},dName),
        el('div',{class:'report-sub'},'Holder’s statement'+(cfg.firm_name?` · ${cfg.firm_name}`:''))),
      el('div',{class:'report-meta'},
        el('div',{},el('strong',{},'As at '),fmtDateLong(asOf)),
        cfg.firm_address?el('div',{},cfg.firm_address):null,
        cfg.firm_contact?el('div',{},cfg.firm_contact):null)),
    reportSection('The holder',reportKV([
      ['Type',inv.entity_type],
      inv.contact_name?['Contact',inv.contact_name]:null,
      ['SSN / EIN',cfg.mask_account_numbers?fmtTaxId(inv.tax_id):(inv.tax_id||'—')],
      inv.email?['Email',inv.email]:null,
      inv.phone?['Telephone',inv.phone]:null,
      investorState(inv)?['State',stateName(investorState(inv))]:null,
      ['Accreditation',inv.accredited_status],
      inv.accreditation_basis?['Established by',inv.accreditation_basis]:null,
      inv.accredited_verified_date?['Verified',fmtDateLong(inv.accredited_verified_date)]:null,
    ])),
    reportSection('Position',reportKV([
      ['Committed across all offerings',money(committed)],
      ['Funds received',money(received)],
      ['Capital on certificate',money(capital)],
      ['Preferred return outstanding',money(owed)],
      ['Distributions received',money(paidTotal)],
    ])),
    inv.subscriptions.length?reportSection('Subscriptions',
      el('table',{class:'report-table'},
        el('thead',{},el('tr',{},el('th',{},'Offering'),el('th',{},'Status'),
          el('th',{class:'num'},'Committed'),el('th',{class:'num'},'Received'),el('th',{},'Signed'),el('th',{},'Funded'))),
        el('tbody',{},...inv.subscriptions.map(s=>el('tr',{style:s.status==='Withdrawn'?'text-decoration:line-through;color:#777':''},
          el('td',{},s.offering_name),el('td',{},s.status),
          el('td',{class:'num'},money(s.amount_committed_cents)),
          el('td',{class:'num'},money(Math.max(0,investorEscrow(s.offering_id,inv.id,s.id).clearedNet))),
          el('td',{},fmtDate(s.sub_signed_date)),el('td',{},fmtDate(s.funded_date))))),
        el('tfoot',{},el('tr',{},el('td',{colspan:'2'},`${inv.subscriptions.length} subscription${inv.subscriptions.length===1?'':'s'}`),
          el('td',{class:'num'},money(committed)),el('td',{class:'num'},money(received)),
          el('td',{},''),el('td',{},''))))):null,
    holdings.length?reportSection('Certificates held',
      el('table',{class:'report-table'},
        el('thead',{},el('tr',{},el('th',{},'Offering'),el('th',{},'No.'),el('th',{},'Class'),
          el('th',{class:'num'},'Capital'),el('th',{class:'num'},'% of issuer'),
          el('th',{class:'num'},'Accrued'),el('th',{class:'num'},'Outstanding'),el('th',{},'Issued'))),
        el('tbody',{},...holdings.map(h=>el('tr',{},
          el('td',{},h.offering.name),el('td',{},h.cert.cert_number),el('td',{},h.cert.class_name||'—'),
          el('td',{class:'num'},h.cert.capital_cents!=null?money(h.cert.capital_cents):'—'),
          el('td',{class:'num'},fmtPct(h.cert.total_pct_shown)),
          el('td',{class:'num'},h.cert.accrued_calc!=null?money(h.cert.accrued_calc):'—'),
          el('td',{class:'num'},h.cert.accrued_outstanding!=null?money(h.cert.accrued_outstanding):'—'),
          el('td',{},fmtDate(h.cert.issue_date))))),
        el('tfoot',{},el('tr',{},el('td',{colspan:'3'},`${holdings.length} certificate${holdings.length===1?'':'s'}`),
          el('td',{class:'num'},money(capital)),el('td',{},''),el('td',{},''),
          el('td',{class:'num'},money(owed)),el('td',{},''))))):null,
    paid.length?reportSection('Distributions received',
      el('table',{class:'report-table'},
        el('thead',{},el('tr',{},el('th',{},'Date'),el('th',{},'Offering'),el('th',{},'Distribution'),
          el('th',{class:'num'},'Preferred return'),el('th',{class:'num'},'Capital'),el('th',{class:'num'},'Total'))),
        el('tbody',{},...paid.map(p=>el('tr',{},
          el('td',{},fmtDate(p.dist.pay_date)),el('td',{},p.offering?p.offering.name:'—'),el('td',{},p.dist.label),
          el('td',{class:'num'},money(p.pref)),el('td',{class:'num'},money(p.capital)),
          el('td',{class:'num'},money(p.pref+p.capital))))),
        el('tfoot',{},el('tr',{},el('td',{colspan:'3'},`${paid.length} distribution${paid.length===1?'':'s'}`),
          el('td',{class:'num'},money(paid.reduce((a,p)=>a+p.pref,0))),
          el('td',{class:'num'},money(paid.reduce((a,p)=>a+p.capital,0))),
          el('td',{class:'num'},money(paidTotal)))))):null,
    inv.notes?reportSection('Notes',el('p',{},inv.notes)):null,
    el('div',{class:'report-foot'},
      (cfg.firm_name?`Prepared by ${cfg.firm_name}. `:''),
      (cfg.report_footer||DEFAULT_REPORT_FOOTER)));
}

