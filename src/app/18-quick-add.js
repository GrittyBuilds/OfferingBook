/* ============================================================================
   GLOBAL "ADD" — quick-create anything from anywhere
   ========================================================================== */
// Pick an offering, then run cb(offering). Skips the picker if there's only one.
async function pickOffering(prompt,cb){
  const offerings=db.offerings.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(!offerings.length){toast('Create an offering first.','error');return;}
  if(offerings.length===1){cb(offerings[0]);return;}
  const list=el('div',{class:'qa-list'},...offerings.map(o=>el('button',{class:'qa-item',type:'button',onclick:()=>{closeModal();cb(o);}},
    el('span',{class:'qa-item-title'},o.name),el('span',{class:'qa-item-desc'},[o.issuer_name,o.status].filter(Boolean).join(' · ')))));
  openShell(prompt,el('div',{class:'modal-body'},list));
}
function openQuickAdd(){
  const go=fn=>{closeModal();fn();};
  const actions=[
    {t:'New offering',d:'Start a new offering / raise',run:()=>openOfferingForm(null,o=>navigate(`/offerings/${o.id}`))},
    {t:'New investor',d:'Add a person or entity to the contact book',run:()=>openInvestorForm(null,i=>navigate(`/investors/${i.id}`))},
    {t:'Add investor to an offering',d:'Create a subscription',run:()=>pickOffering('Add an investor to which offering?',async o=>{
      const investors=await api.listInvestors();openSubscriptionForm(o,investors,null,()=>refresh());})},
    {t:'Record an escrow deposit',d:'Add an escrow ledger entry',run:()=>pickOffering('Record a deposit for which offering?',async o=>{
      const investors=await api.listInvestors();openEscrowForm(o.id,investors,null,()=>refresh());})},
    {t:'Conduct a closing',d:'Release escrow and issue certificates',run:()=>pickOffering('Conduct a closing on which offering?',async o=>{
      const subs=await api.listSubscriptions(o.id);const open=subs.filter(s=>s.status!=='Withdrawn'&&!s.closing_id);
      const closings=db.closings.filter(c=>c.offering_id===o.id);openClosingForm(o.id,open,closings.length,()=>refresh());})},
    {t:'Add a certificate',d:'Issue a certificate manually',run:()=>pickOffering('Add a certificate to which offering?',async o=>{
      const investors=await api.listInvestors();const{classNames,classes}=await api.listCertificates(o.id);
      openCertificateForm(o,investors,[...new Set([...(classes||[]).map(c=>c.name),...classNames])],null,()=>refresh());})},
  ];
  const list=el('div',{class:'qa-list'},...actions.map(a=>el('button',{class:'qa-item',type:'button',onclick:()=>go(a.run)},
    el('span',{class:'qa-item-title'},a.t),el('span',{class:'qa-item-desc'},a.d))));
  openShell('Add',el('div',{class:'modal-body'},list));
}


