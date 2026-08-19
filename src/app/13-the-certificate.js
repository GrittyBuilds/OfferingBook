/* ============================================================================
   THE CERTIFICATE

   The app computed the number, the class, the capital, the percentage, the
   rate and the issue date, and then had no way to print a certificate. An
   application named for a muniment of title did not produce one.

   It is deliberately plain: a statement of what the record holds, with the
   figures that were computed and the ones that were entered, and a footer
   that does not pretend to be the instrument itself. The executed operating
   agreement or subscription agreement is the instrument; this evidences it.
   ========================================================================== */
async function printCertificate(offeringId,certId){
  try{
    const[offering,data]=await Promise.all([api.getOffering(offeringId),api.listCertificates(offeringId)]);
    const cert=data.certificates.find(c=>c.id===Number(certId));
    if(!cert)throw new Error('Certificate not found');
    printDocument(()=>buildCertificate(offering,cert,data),{failure:'Could not build the certificate'});
  }catch(e){toast('Could not build the certificate: '+e.message,'error');}
}
function buildCertificate(o,c,data){
  const cfg=settings();
  const chain=certificateChain(c.id);
  const priorNumbers=chain.slice(0,-1).map(x=>x.cert_number).filter(Boolean);
  const inv=c.investor_id?db.investors.find(i=>i.id===c.investor_id):null;
  const units=(()=>{
    const sub=c.subscription_id?db.subscriptions.find(s=>s.id===c.subscription_id):null;
    if(sub&&sub.units!=null)return sub.units;
    const price=inherited(scopeFor({offering:o,subscription:sub||undefined}),'price_per_unit_cents');
    if(!price||c.capital_cents==null)return null;
    const raw=c.capital_cents/price;
    return o.fractional_allowed?+raw.toFixed(6):(Math.abs(raw-Math.round(raw))<1e-6?Math.round(raw):null);
  })();
  return el('div',{class:'cert-doc'},
    el('div',{class:'report-lockup'},
      el('span',{html:REPORT_MARK}),
      el('span',{class:'rl-name'},'Muniment')),
    el('div',{class:'cert-head'},
      el('div',{class:'cert-issuer'},o.issuer_name||o.name),
      el('h1',{},'Certificate of ',c.class_name||o.security_type||'Interest'),
      el('div',{class:'cert-number'},'No. ',el('span',{class:'mono'},c.cert_number||'—'))),
    el('p',{class:'cert-body'},
      'This certifies that ',
      el('strong',{},c.holder_name||(inv?investorDisplayName(inv):'—')),
      ' is the registered holder of ',
      units!=null?el('strong',{},`${units} ${units===1?'unit':'units'}`):el('strong',{},'the interest recorded below'),
      ' of ',el('strong',{},c.class_name||o.security_type||'the issuer'),
      ' in ',el('strong',{},o.issuer_name||o.name),
      ', representing ',el('strong',{},fmtPct(c.total_pct_shown)),
      ' of the total interests outstanding as at the date below, transferable only in accordance with the governing instruments and applicable securities laws.'),
    el('table',{class:'report-table cert-table'},
      el('tbody',{},
        ...[
          ['Holder',c.holder_name||(inv?investorDisplayName(inv):'—')],
          inv&&inv.entity_type?['Holder type',inv.entity_type]:null,
          ['Class / series',c.class_name||'—'],
          ['Capital contributed',c.capital_cents!=null?money(c.capital_cents):(c.no_capital?'None — issued for consideration other than cash':'—')],
          units!=null?['Units',String(units)]:null,
          ['Percentage of class',fmtPct(c.pct_of_class_shown)],
          ['Percentage of the issuer',fmtPct(c.total_pct_shown)],
          c.pref_return_rate!=null?['Preferred return',`${fmtRate(c.pref_return_rate)} per annum, ${accrualConvention(c.accrual_convention_calc).label.toLowerCase()}`]:null,
          c.accrual_start?['Accruing from',fmtDateLong(c.accrual_start)]:null,
          ['Funded',c.funded_date?fmtDateLong(c.funded_date):'—'],
          ['Issued',c.issue_date?fmtDateLong(c.issue_date):'—'],
          o.exemption?['Offering exemption',o.exemption]:null,
          priorNumbers.length?['Issued on transfer of',priorNumbers.join(', ')]:null,
          c.cancelled_date?['Cancelled',fmtDateLong(c.cancelled_date)]:null,
        ].filter(Boolean).map(([k,v])=>el('tr',{},el('th',{scope:'row'},k),el('td',{},v))))),
    c.cancelled_date?el('p',{class:'cert-void'},'This certificate has been cancelled and is reproduced for the record only.'):null,
    el('div',{class:'cert-sign'},
      el('div',{class:'cert-sig'},el('div',{class:'cert-rule'}),el('div',{class:'cert-cap'},'Authorised signatory, ',o.issuer_name||o.name)),
      el('div',{class:'cert-sig'},el('div',{class:'cert-rule'}),el('div',{class:'cert-cap'},'Date'))),
    el('div',{class:'report-foot'},
      (cfg.firm_name?`Prepared by ${cfg.firm_name}. `:''),
      'This certificate evidences the interest recorded in the issuer’s books as at ',fmtDateLong(data.asOf||todayISO()),
      '. It is not the instrument creating that interest: the executed subscription agreement and governing documents are. ',
      (cfg.report_footer||DEFAULT_REPORT_FOOTER)));
}

