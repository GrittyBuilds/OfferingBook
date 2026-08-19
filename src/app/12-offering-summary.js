/* ============================================================================
   PRINTABLE CLOSING / INVESTOR SUMMARY
   ========================================================================== */
const REPORT_MARK='<svg viewBox="0 0 64 64" aria-hidden="true">'
  +'<rect x="6" y="9" width="12" height="32" rx="1.5" fill="#14453F"/>'
  +'<rect x="26" y="25" width="12" height="16" rx="1.5" fill="#14453F"/>'
  +'<rect x="46" y="9" width="12" height="32" rx="1.5" fill="#14453F"/>'
  +'<rect x="6" y="45" width="52" height="10" rx="1.5" fill="#A8813C"/></svg>';
function reportSection(title,...nodes){return el('section',{class:'report-section'},el('h2',{},title),...nodes);}
function reportKV(pairs){return el('div',{class:'report-kv'},...pairs.filter(Boolean).map(([k,v])=>
  el('div',{class:'kv'},el('span',{class:'k'},k),el('span',{class:'v'},v??'—'))));}

function buildSummaryReport(o,subs,escrowData,reconData,closingsData,certsData){
  const s=o.summary,es=escrowData.summary;
  const cfg=settings();
  const closings=(closingsData&&closingsData.closings)||[];
  const certs=(certsData&&certsData.certificates)||[];
  // Withdrawn subscriptions appear on the roster — the record is the record —
  // but are struck through and count towards nothing.
  const live=subs.filter(x=>x.status!=='Withdrawn');
  const committed=live.reduce((a,x)=>a+(x.amount_committed_cents||0),0);
  const signedCount=live.filter(x=>['Sub signed','Funded','Closed'].includes(effectiveSubStatus(x))).length;
  const asOf=fmtDateLong(todayISO());
  const genDate=new Date().toLocaleString('en-US',{dateStyle:'long',timeStyle:'short'});
  const minMet=o.target_min_cents&&s.minRaiseMet;
  // The account number prints masked unless the firm has said otherwise.
  const acct=o.escrow_account_number
    ? (cfg.mask_account_numbers?fmtTaxId(o.escrow_account_number):o.escrow_account_number):null;

  const closingNodes=o.target_min_cents?[
    reportKV([
      ['Minimum raise (min-raise)',money(o.target_min_cents)],
      ['Subscriber funds cleared (net of refunds)',money(s.escrow.clearedNetDeposits)],
      ['Final close deadline',o.no_deadline?'Open-ended (no deadline)':(o.final_close_date?fmtDateLong(o.final_close_date):'—')],
      ['Amount still needed',minMet?'$0.00':money((o.target_min_cents||0)-s.escrow.clearedNetDeposits)],
    ]),
    el('p',{style:'margin:10px 0 0'},
      el('span',{class:'report-badge '+(minMet?'met':'no')},minMet?'MINIMUM RAISE MET — CLOSING MAY PROCEED':'MINIMUM RAISE NOT YET MET')),
  ]:[el('p',{class:'report-sub'},'No minimum raise is set for this offering.')];

  const showCosts=!!o.pass_through_costs;
  const totalCosts=live.reduce((a,x)=>a+(x.costs_cents||0),0);
  const investorTable=subs.length?el('table',{class:'report-table'},
    el('thead',{},el('tr',{},el('th',{},'Investor'),el('th',{},'Email'),el('th',{},'Accredited'),
      el('th',{class:'num'},'Committed'),showCosts?el('th',{class:'num'},'Costs'):null,showCosts?el('th',{class:'num'},'Total due'):null,
      el('th',{class:'num'},'Units'),el('th',{},'Sub status'),el('th',{},'Signed'))),
    el('tbody',{},...subs.map(x=>{const gone=x.status==='Withdrawn';
      return el('tr',{style:gone?'color:#999':''},
      el('td',{},el('strong',{style:gone?'text-decoration:line-through':''},x.investor_name||'—'),x.entity_type?el('div',{style:'color:#666;font-size:10px'},x.entity_type):null),
      el('td',{},x.email||'—'),el('td',{},x.accredited_status||'—'),
      el('td',{class:'num'},money(x.amount_committed_cents)),
      showCosts?el('td',{class:'num'},x.costs_cents?money(x.costs_cents):'—'):null,
      showCosts?el('td',{class:'num'},money((x.amount_committed_cents||0)+(x.costs_cents||0))):null,
      el('td',{class:'num'},x.units??'—'),
      el('td',{},gone?'Withdrawn':effectiveSubStatus(x)),el('td',{},fmtDate(x.sub_signed_date)));})),
    el('tfoot',{},el('tr',{},el('td',{colspan:'3'},`Total — ${live.length} investor${live.length===1?'':'s'} (${signedCount} signed/funded${subs.length>live.length?`; ${subs.length-live.length} withdrawn excluded`:''})`),
      el('td',{class:'num'},money(committed)),
      showCosts?el('td',{class:'num'},money(totalCosts)):null,
      showCosts?el('td',{class:'num'},money(committed+totalCosts)):null,
      el('td',{colspan:'3'},'')))
  ):el('p',{class:'report-sub'},'No investors recorded on this offering.');

  // Chronological, oldest first, with a running book balance: the order a
  // ledger is read in, and the column that lets its total be checked by eye.
  // Only the four movement types the balances are built from — a row with an
  // unknown type (a hand-edited file) must not appear in a ledger whose stated
  // totals exclude it.
  const txns=escrowData.transactions.filter(t=>['deposit','release','refund','fee'].includes(t.txn_type))
    .slice().sort((a,b)=>
    (a.txn_date||a.created_at||'').localeCompare(b.txn_date||b.created_at||'')||a.id-b.id);
  let running=0;
  const ledgerTable=txns.length?el('table',{class:'report-table'},
    el('thead',{},el('tr',{},el('th',{},'Date'),el('th',{},'Type'),el('th',{},'Investor'),el('th',{},'Method / ref'),
      el('th',{},'Cleared'),el('th',{class:'num'},'Amount'),el('th',{class:'num'},'Balance'))),
    el('tbody',{},...txns.map(t=>{const out=t.txn_type!=='deposit';
      running+=(out?-1:1)*(Number(t.amount_cents)||0);
      return el('tr',{},el('td',{},fmtDate(t.txn_date)),el('td',{},t.txn_type.charAt(0).toUpperCase()+t.txn_type.slice(1)),el('td',{},t.investor_name||'—'),
        el('td',{},[t.method,t.reference].filter(Boolean).join(' · ')||'—'),el('td',{},t.cleared?'Cleared':'Pending'),
        el('td',{class:'num'},(out?'−':'+')+money(t.amount_cents)),
        el('td',{class:'num'},money(running)));})),
    el('tfoot',{},el('tr',{},el('td',{colspan:'6'},'Book balance (all entries)'),el('td',{class:'num'},money(es.bookBalance))),
      el('tr',{},el('td',{colspan:'6'},'Cleared balance (cleared entries only)'),el('td',{class:'num'},money(es.clearedBalance))))
  ):el('p',{class:'report-sub'},'No escrow activity recorded.');

  const latestRecon=reconData.reconciliations[0];

  return el('div',{class:'report'},
    el('div',{class:'report-head'},
      el('div',{},
        el('div',{class:'report-lockup',html:REPORT_MARK+'<span class="rl-name">Muniment</span>'}),
        el('h1',{},o.name),
        el('div',{class:'report-sub'},[o.issuer_name,o.exemption,o.security_type].filter(Boolean).join(' · ')||'—')),
      el('div',{class:'report-meta'},
        cfg.firm_name?el('span',{},el('strong',{},cfg.firm_name),el('br')):null,
        cfg.firm_contact?el('span',{},cfg.firm_contact,el('br')):null,
        el('strong',{},'Offering & Investor Summary'),el('br'),
        'Status: '+o.status,el('br'),
        'As of '+asOf,el('br'),
        el('span',{style:'color:#777'},'Generated '+genDate))),
    reportSection('Offering details',reportKV([
      ['Issuer / client',o.issuer_name],['Status',o.status],['Exemption',o.exemption],['Security type',o.security_type],
      ['Price per unit',o.price_per_unit_cents!=null?money(o.price_per_unit_cents):null],
      ['Minimum investment',minInvestDisplay(o)],
      ['Minimum raise',o.target_min_cents!=null?money(o.target_min_cents):null],
      ['Maximum raise',maxRaiseDisplay(o)],
      ['Launch date',o.launch_date?fmtDate(o.launch_date):null],['Form D filed',o.form_d_filed_date?fmtDate(o.form_d_filed_date):null],
      ['First / interim close',o.first_close_date?fmtDate(o.first_close_date):null],['Final close deadline',closeDeadlineDisplay(o)],
      ['Escrow agent',o.escrow_agent],['Escrow bank',o.escrow_bank],['Escrow account #',acct],
    ])),
    reportSection('Closing readiness',...closingNodes),
    reportSection('Escrow summary',reportKV([
      ['Total deposits',money(es.deposits)],['Cleared deposits',money(es.clearedDeposits)],
      ['Releases to issuer',money(es.releases)],['Refunds to investors',money(es.refunds)],
      ['Fees / expenses',money(es.fees)],['Pending (uncleared)',money(es.pendingBalance)],
      ['Cleared balance',money(es.clearedBalance)],['Book balance',money(es.bookBalance)],
    ])),
    reportSection(`Investors (${subs.length}) — ${money(committed)} committed`,investorTable),
    closings.length?reportSection('Closings',el('table',{class:'report-table'},
      el('thead',{},el('tr',{},el('th',{},'Closing'),el('th',{},'Date'),el('th',{class:'num'},'Investors'),el('th',{class:'num'},'Released'),el('th',{class:'num'},'Fees'))),
      el('tbody',{},...closings.map(c=>el('tr',{},el('td',{},c.label),el('td',{},fmtDate(c.closing_date)),
        el('td',{class:'num'},String(c.investor_count)),el('td',{class:'num'},money(c.amount_released_cents)),el('td',{class:'num'},money(c.fees_cents))))),
      el('tfoot',{},el('tr',{},el('td',{colspan:'3'},'Total released to issuer'),el('td',{class:'num'},money(closingsData.totalReleased)),
        el('td',{class:'num'},money(closings.reduce((a,c)=>a+(c.fees_cents||0),0))))))):null,
    certs.length?reportSection('Certificate roster',el('table',{class:'report-table'},
      el('thead',{},el('tr',{},el('th',{},'Cert #'),el('th',{},'Holder'),el('th',{},'Class'),el('th',{class:'num'},'Capital'),
        el('th',{class:'num'},'% of Class'),el('th',{class:'num'},'Total %'),el('th',{class:'num'},'Pref %'),el('th',{class:'num'},'Accrued'))),
      el('tbody',{},...certs.map(c=>el('tr',{},el('td',{},c.cert_number),el('td',{},c.holder_name||'—'),el('td',{},c.class_name||'—'),
        el('td',{class:'num'},c.capital_cents!=null?money(c.capital_cents):'—'),el('td',{class:'num'},fmtPct(c.pct_of_class_shown)),el('td',{class:'num'},fmtPct(c.total_pct_shown)),
        el('td',{class:'num'},c.pref_return_rate!=null?fmtRate(c.pref_return_rate):'—'),el('td',{class:'num'},c.accrued_calc!=null?money(c.accrued_calc):'—')))),
      el('tfoot',{},el('tr',{},el('td',{colspan:'3'},`Total — ${certs.length} certificate${certs.length===1?'':'s'}`),
        el('td',{class:'num'},money(certsData.totalCapital)),el('td',{},''),el('td',{class:'num'},fmtPct(certsData.totalPercent)),
        el('td',{},''),el('td',{class:'num'},money(certsData.totalAccrued)))))):null,
    reportSection('Escrow ledger',ledgerTable),
    latestRecon?reportSection('Latest bank reconciliation',reportKV([
      ['Statement date',latestRecon.statement_date?fmtDate(latestRecon.statement_date):null],
      ['Statement balance',money(latestRecon.statement_balance_cents)],
      ['App cleared balance',money(latestRecon.app_cleared_cents)],
      ['Difference',latestRecon.difference_cents===0?'Matches':money(latestRecon.difference_cents)],
    ])):null,
    el('div',{class:'report-foot'},
      (cfg.firm_name?`Prepared by ${cfg.firm_name}. `:''),
      (cfg.report_footer||DEFAULT_REPORT_FOOTER)+' ',
      'Verify every amount against source documents and the escrow bank statement before any closing.'),
  );
}

// Put a built document on the page, print it, and take it away again. Shared
// by every report, so none of them can forget the cleanup that stops a later
// plain Ctrl+P printing yesterday's report by surprise.
function printDocument(build,{failure='Could not build the document'}={}){
  try{
    const root=document.getElementById('print-root');clear(root);
    root.appendChild(build());
    let done=false;
    const cleanup=()=>{if(done)return;done=true;clear(root);window.removeEventListener('afterprint',cleanup);};
    window.addEventListener('afterprint',cleanup);
    setTimeout(()=>{window.print();
      // iOS Safari never fires afterprint; clear on a timer too.
      setTimeout(cleanup,1500);},60);
  }catch(e){toast(failure+': '+e.message,'error');}
}

async function printOfferingSummary(offeringId){
  try{
    const[offering,subs,escrowData,reconData,closingsData,certsData]=await Promise.all([
      api.getOffering(offeringId),api.listSubscriptions(offeringId),api.listEscrow(offeringId),
      api.listReconciliations(offeringId),api.listClosings(offeringId),api.listCertificates(offeringId)]);
    printDocument(()=>buildSummaryReport(offering,subs,escrowData,reconData,closingsData,certsData),
      {failure:'Could not build the summary'});
  }catch(e){toast('Could not build the summary: '+e.message,'error');}
}

