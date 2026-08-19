/* ============================================================================
   AFTER THE CLOSING

   The app modelled the deal beautifully up to the moment the certificate was
   issued and then stopped, while the file itself runs for years past that
   point. Distributions, transfers, redemptions and staged funding all live
   here. Escrow is deliberately untouched by any of it: escrow is the account
   money sits in before a closing, and none of this happens before one.
   ========================================================================== */

/* Split `total` cents across weights, exactly. Largest remainder again, for
   the same reason as the percentage column: a distribution whose parts come
   to a cent less than the cheque is a distribution somebody has to explain. */
function allocateCents(total,weights){
  const sum=weights.reduce((a,w)=>a+(Number(w)||0),0);
  if(!(sum>0)||!total)return weights.map(()=>0);
  const exact=weights.map(w=>total*(Number(w)||0)/sum);
  const floors=exact.map(Math.floor);
  let short=total-floors.reduce((a,n)=>a+n,0);
  const order=exact.map((v,i)=>[v-floors[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  for(let k=0;k<order.length&&short>0;k++,short--)floors[order[k][1]]++;
  for(let k=order.length-1;k>=0&&short<0;k--,short++)floors[order[k][1]]--;
  return floors;
}

const DISTRIBUTION_BASES=[
  {value:'pref-first',label:'Preferred return first, then capital',
   help:'Pays what has accrued and is still owed, in proportion to it. Anything left over is returned as capital, pro rata by ownership.'},
  {value:'pro-rata',label:'Pro rata by ownership',
   help:'Split by total percentage interest, without regard to what has accrued.'},
  {value:'capital-return',label:'Return of capital',
   help:'Pro rata by the capital still outstanding on each certificate.'},
];

// What a distribution of `amountCents` would give each holder, under a basis.
// Returns rows the form can show and the user can override before anything is
// written — the same discipline as the suggestion strip.
function proposeDistribution(offeringId,amountCents,basis,asOf){
  const r=computeCertificates(offeringId,asOf);
  const live=r.certificates.filter(c=>!c.cancelled_date);
  const rows=live.map(c=>({
    certificate_id:c.id,investor_id:c.investor_id??null,
    holder:c.holder_name||'—',cert_number:c.cert_number,class_name:c.class_name,
    owed:c.accrued_outstanding||0,
    capitalLeft:Math.max(0,(c.capital_cents||0)-(c.capital_returned_cents||0)),
    ownership:Number(c.total_pct_shown)||0,
    pref_cents:0,capital_cents:0}));
  const amount=Math.max(0,Number(amountCents)||0);
  if(!amount||!rows.length)return{rows,basis,allocated:0,unallocated:amount};

  if(basis==='pro-rata'){
    allocateCents(amount,rows.map(r2=>r2.ownership)).forEach((v,i)=>{rows[i].capital_cents=v;});
  }else if(basis==='capital-return'){
    allocateCents(amount,rows.map(r2=>r2.capitalLeft)).forEach((v,i)=>{rows[i].capital_cents=v;});
  }else{
    // Preferred first. Where the money does not cover what is owed it is
    // split in proportion to what is owed — never rounded up to satisfy one
    // holder and leave another short.
    const owedTotal=rows.reduce((a,r2)=>a+r2.owed,0);
    const toPref=Math.min(amount,owedTotal);
    if(toPref>0)allocateCents(toPref,rows.map(r2=>r2.owed)).forEach((v,i)=>{rows[i].pref_cents=v;});
    const rest=amount-toPref;
    if(rest>0)allocateCents(rest,rows.map(r2=>r2.ownership)).forEach((v,i)=>{rows[i].capital_cents=v;});
  }
  const allocated=rows.reduce((a,r2)=>a+r2.pref_cents+r2.capital_cents,0);
  return{rows,basis,allocated,unallocated:amount-allocated};
}

/* ---- The chain of title --------------------------------------------------
   A certificate could be created or deleted and nothing else, so the cap
   table could only ever describe the original issuance and drifted out of
   date from the first secondary transfer onward. A transfer now cancels the
   certificate it came from and issues a successor that points back at it;
   deleting the transfer puts both back. Nothing is rewritten in place — a
   muniment of title that quietly changes hands is not evidence of anything. */
function certificateChain(certId){
  const out=[];
  let id=Number(certId);
  const guard=new Set();
  while(id&&!guard.has(id)){
    guard.add(id);
    const c=db.certificates.find(x=>x.id===id);
    if(!c)break;
    out.unshift(c);
    const t=db.transfers.find(x=>x.to_certificate_id===c.id);
    id=t?t.from_certificate_id:null;
  }
  return out;
}
const TRANSFER_KINDS=[
  {value:'transfer',label:'Transfer / assignment',help:'The holding passes to another holder. A successor certificate is issued.'},
  {value:'redemption',label:'Redemption',help:'The holding is bought back and leaves the cap table. No successor is issued.'},
];

/* ---- Staged funding ------------------------------------------------------
   For a fund that draws down over years, committed and funded are different
   numbers for most of the file's life. An offering says whether it funds in
   one payment or in calls; where it calls, what a subscriber owes today is
   what has been called of them, not what they promised in total. */
function callsFor(offeringId,subscriptionId,asOf){
  const cut=asOf||todayISO();
  let called=0;
  for(const c of db.capital_calls.filter(x=>x.offering_id===Number(offeringId))){
    if(c.call_date&&c.call_date>cut)continue;
    for(const a of(c.allocations||[]))
      if(a.subscription_id===Number(subscriptionId))called+=Number(a.amount_cents)||0;
  }
  return called;
}
// What a call of `percent` of each commitment would come to, per subscriber.
function proposeCall(offeringId,percent){
  offeringId=Number(offeringId);
  const pct=Math.max(0,Number(percent)||0);
  return db.subscriptions.filter(s=>s.offering_id===offeringId&&s.status!=='Withdrawn')
    .map(s=>{const inv=db.investors.find(i=>i.id===s.investor_id);
      const commitment=s.amount_committed_cents||0;
      const already=callsFor(offeringId,s.id);
      return{subscription_id:s.id,investor_id:s.investor_id,
        holder:inv?investorDisplayName(inv):'—',
        commitment,already,
        // Never call more than was committed, however the percentages add up.
        amount_cents:Math.max(0,Math.min(commitment-already,Math.round(commitment*pct/100)))};});
}

/* ---- Making a percentage column add up -----------------------------------
   Rounding each share independently leaves the column a basis point short or
   long. Largest remainder gives the odd units to the rows with the biggest
   fractional parts, so every displayed figure is within one unit of its exact
   share and the column totals exactly what it should.

   Rows carrying a manual override are left exactly as entered — someone typed
   that figure, and it is not this function's business to nudge it. */
const PCT_PLACES=4;
function settlePercentages(rows,fromKey,toKey,target){
  const unit=Math.pow(10,PCT_PLACES);             // work in ten-thousandths of a per cent
  const live=rows.filter(r=>r[fromKey]!=null&&isFinite(r[fromKey]));
  for(const r of rows)r[toKey]=r[fromKey];
  if(!live.length)return;
  const exact=live.reduce((a,r)=>a+Number(r[fromKey]),0);
  // Only settle a column that is already trying to be the target. A class
  // whose shares genuinely sum to 60% must not be inflated to 100%.
  if(Math.abs(exact-target)>0.5)return;
  const scaled=live.map(r=>Number(r[fromKey])*unit);
  const floors=scaled.map(Math.floor);
  let short=Math.round(target*unit)-floors.reduce((a,n)=>a+n,0);
  const order=scaled.map((v,i)=>[v-floors[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  for(let k=0;k<order.length&&short>0;k++,short--)floors[order[k][1]]++;
  // A column that came in long gives units back from the smallest remainders.
  for(let k=order.length-1;k>=0&&short<0;k--,short++)floors[order[k][1]]--;
  live.forEach((r,i)=>{r[toKey]=floors[i]/unit;});
}
// Create certificates for the subscriptions included in a closing. Numbers are
// assigned in funding-date order, continuing from the highest existing number.
function generateCertificatesForClosing(offeringId,closing,subIds){
  const o=db.offerings.find(x=>x.id===offeringId);if(!o)return 0;
  const existing=db.certificates.filter(c=>c.offering_id===offeringId);
  // One rule, read from the offering — the same one the manual form follows.
  let maxNum=highestCertNumber(offeringId);
  let maxSort=existing.reduce((m,c)=>Math.max(m,c.sort_index||0),0);
  const subs=subIds.map(id=>db.subscriptions.find(s=>s.id===id&&s.offering_id===offeringId))
    .filter(Boolean).filter(s=>s.investor_id).filter(s=>!existing.some(c=>c.subscription_id===s.id));
  subs.sort((a,b)=>{const fa=a.funded_date||closing.closing_date||'',fb=b.funded_date||closing.closing_date||'';
    if(fa!==fb)return fa.localeCompare(fb);
    const ia=db.investors.find(x=>x.id===a.investor_id),ib=db.investors.find(x=>x.id===b.investor_id);
    return investorSortKey(ia||{}).localeCompare(investorSortKey(ib||{}));});
  let made=0;
  for(const s of subs){
    const tr=(o.tranches||[]).find(t=>t.id===s.tranche_id);
    const className=(tr&&tr.class_name)||defaultInvestedClass(o)||o.security_type||'Units';
    const rate=(tr&&tr.default_return_rate!=null)?tr.default_return_rate:(o.default_return_rate!=null?o.default_return_rate:null);
    maxNum++;maxSort++;made++;
    db.certificates.push({id:nextId('certificates'),offering_id:offeringId,subscription_id:s.id,closing_id:closing.id,
      investor_id:s.investor_id,holder_name:null,class_name:className,capital_cents:s.amount_committed_cents||0,
      pct_of_class:null,percent_interest:null,pref_return_rate:rate,accrued_cents:null,
      funded_date:s.funded_date||closing.closing_date||null,accrual_start:closing.closing_date||null,
      issue_date:closing.closing_date||null,cert_number:formatCertNumber(o,maxNum),sort_index:maxSort,no_capital:0,
      // Written down at issue, so a convention chosen later never restates a
      // certificate that was computed under the old one.
      accrual_convention:(tr&&tr.accrual_convention)||o.accrual_convention||settings().default_accrual_convention,
      created_at:nowISO()});}
  return made;
}

