/* ============================================================================
   FORMS (open modal → call api)
   ========================================================================== */
// A new offering starts from the firm's own settings rather than from blank
// fields. Everything here is editable; none of it has to be typed again.
function newOfferingDefaults(){
  const cfg=settings();
  const escrow=cfg.default_escrow_party_id?partyById(cfg.default_escrow_party_id):null;
  return{status:'Drafting',
    exemption:cfg.default_exemption||'',
    security_type:cfg.default_security_type||'',
    default_return_rate:cfg.default_return_rate??'',
    min_investment:centsToInput(cfg.default_min_investment_cents),
    costs_label:cfg.default_costs_label||'',
    escrow_agent:escrow?escrow.name:'',
    escrow_bank:escrow?escrow.bank_name||'':'',
    escrow_party_id:escrow?escrow.id:null,
    cert_prefix:(cfg.default_cert_number_format&&cfg.default_cert_number_format.prefix)||'',
    cert_pad:(cfg.default_cert_number_format&&cfg.default_cert_number_format.pad)||1,
    accrual_convention:'',
    launch_date:''};
}
// Fill a blank field from a directory entry, and never overwrite something the
// user has already put there.
function fillFrom(api,values,pairs){
  for(const[field,value]of pairs)
    if(value&&!values[field])api.setValue(field,value);
}

function openOfferingForm(existing,onDone){
  const isEdit=!!existing;
  formModal({title:isEdit?'Edit offering':'New offering',wide:true,submitLabel:isEdit?'Save changes':'Create offering',
    values:existing?{name:existing.name,issuer_name:existing.issuer_name,exemption:existing.exemption,security_type:existing.security_type,
      status:existing.status,target_min:centsToInput(existing.target_min_cents),target_max:centsToInput(existing.target_max_cents),
      price_per_unit:centsToInput(existing.price_per_unit_cents),min_investment:centsToInput(existing.min_investment_cents),
      launch_date:existing.launch_date,first_close_date:existing.first_close_date,final_close_date:existing.final_close_date,
      form_d_filed_date:existing.form_d_filed_date,escrow_agent:existing.escrow_agent,escrow_bank:existing.escrow_bank,
      escrow_account_number:existing.escrow_account_number,notes:existing.notes,
      default_return_rate:existing.default_return_rate??'',pass_through_costs:existing.pass_through_costs,costs_label:existing.costs_label,
      no_max:existing.no_max,fractional_allowed:existing.fractional_allowed,no_deadline:existing.no_deadline,
      staged_funding:existing.staged_funding,
      issuer_party_id:existing.issuer_party_id,escrow_party_id:existing.escrow_party_id,
      cert_prefix:(existing.cert_number_format&&existing.cert_number_format.prefix)||'',
      cert_pad:(existing.cert_number_format&&existing.cert_number_format.pad)||1,
      accrual_convention:existing.accrual_convention||'',
      bad_actor_checked_date:existing.bad_actor_checked_date,bad_actor_notes:existing.bad_actor_notes,
      general_solicitation:existing.general_solicitation}:newOfferingDefaults(),
    fields:[
      {name:'name',label:'Offering name',required:true,placeholder:'e.g. Acme Fund I'},
      {name:'issuer_name',label:'Issuer / client',half:true,placeholder:'Issuing entity',
        datalist:partiesByRole('Issuer').map(x=>x.name),
        help:partiesByRole('Issuer').length?'Pick a client you have already set up, or type a new one.':'Set clients up once under Settings and they appear here.',
        onChange:(v,f)=>{const party=partiesByRole('Issuer').find(x=>x.name===v.issuer_name);
          f.setValue('issuer_party_id',party?party.id:'');}},
      {name:'issuer_party_id',type:'hidden'},
      {name:'status',label:'Status',type:'select',options:OFFERING_STATUSES,half:true},
      {name:'exemption',label:'Exemption',type:'select',options:['',...EXEMPTIONS],half:true},
      {name:'security_type',label:'Security type',type:'select',options:['',...SECURITY_TYPES],half:true},
      {name:'target_min',label:'Minimum raise (min-raise)',type:'money',half:true,help:'Escrow must reach this before a closing.'},
      {name:'target_max',label:'Maximum raise',type:'money',half:true},
      {name:'no_max',label:'No maximum — uncapped raise',type:'checkbox',help:'Ignores the Maximum raise amount.'},
      {name:'price_per_unit',label:'Price per unit',type:'money',half:true},
      {name:'min_investment',label:'Minimum investment',type:'money',half:true},
      {name:'default_return_rate',label:'Preferred return / interest rate (%)',type:'number',step:'any',half:true,help:'Default rate for certificates; accrues from the closing date.'},
      {name:'fractional_allowed',label:'Allow fractional investments / units (minimum may be waived)',type:'checkbox'},
      {name:'staged_funding',label:'Funds in stages — capital is drawn down by call',type:'checkbox',
        help:'What a subscriber owes becomes what has been called of them, rather than the whole commitment. A Capital calls panel appears on the Investors tab.'},
      {name:'pass_through_costs',label:'Pass legal / professional costs through to investors',type:'checkbox',help:'Adds a cost field to each subscription, charged on top of the investment.'},
      {name:'costs_label',label:'Label for the pass-through cost',half:true,placeholder:'e.g. Legal & professional fees',showIf:v=>!!v.pass_through_costs},
      {name:'launch_date',label:'Launch date',type:'date',half:true},
      {name:'form_d_filed_date',label:'Form D filed',type:'date',half:true},
      {name:'first_close_date',label:'First / interim close',type:'date',half:true},
      {name:'final_close_date',label:'Final close deadline',type:'date',half:true},
      {name:'no_deadline',label:'No final close deadline (open-ended)',type:'checkbox',help:'Ignores the Final close deadline date.'},
      {name:'escrow_agent',label:'Escrow agent',half:true,placeholder:'Escrow company',
        datalist:partiesByRole('Escrow agent').map(x=>x.name),
        help:'Choosing an agent you have used before fills in its bank and account.',
        onChange:(v,f)=>{const party=partiesByRole('Escrow agent').find(x=>x.name===v.escrow_agent);
          f.setValue('escrow_party_id',party?party.id:'');
          if(party&&f.changed==='escrow_agent')
            fillFrom(f,v,[['escrow_bank',party.bank_name],['escrow_account_number',party.account_number]]);}},
      {name:'escrow_party_id',type:'hidden'},
      {name:'escrow_bank',label:'Escrow bank',half:true},
      {name:'escrow_account_number',label:'Escrow account #',half:true,mono:true},

      {type:'section',label:'Exemption diligence'},
      {name:'bad_actor_checked_date',label:'Bad-actor inquiry completed',type:'date',half:true,
        help:'Rule 506(d). The date the disqualification inquiry was made for the issuer and its covered persons.'},
      {name:'general_solicitation',label:'This offering is generally solicited or advertised',type:'checkbox',
        help:'Permitted under 506(c), where every purchaser must be verified. Not permitted under 506(b).'},
      {name:'bad_actor_notes',label:'Inquiry notes',type:'textarea',rows:2,
        placeholder:'Who was asked, what was reviewed, and what it found.'},

      {type:'section',label:'Certificates'},
      {name:'cert_prefix',label:'Certificate number prefix',half:true,mono:true,placeholder:'e.g. A-',
        help:'Both the closing that issues certificates and the form that adds one by hand follow this.'},
      {name:'cert_pad',label:'Digits',type:'number',step:'1',half:true,placeholder:'1',
        help:'3 numbers them 001, 002, 003. 1 leaves them unpadded.'},
      {name:'accrual_convention',label:'Preferred return accrues',type:'select',half:true,
        options:[{value:'',label:`— The firm default (${accrualConvention(settings().default_accrual_convention).label}) —`},
          ...ACCRUAL_CONVENTIONS.map(c=>({value:c.value,label:c.label}))],
        help:'Applies to certificates issued from now on. Those already issued keep the convention they were written under.'},

      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{const saved=isEdit?await api.updateOffering(existing.id,v):await api.createOffering(v);
      toast(isEdit?'Offering updated.':'Offering created.','success');onDone?.(saved);}});
}
function openInvestorForm(existing,onDone){
  const isEdit=!!existing;
  const person=v=>isPersonType(v.entity_type);
  const isEntity=v=>!isPersonType(v.entity_type);
  formModal({title:isEdit?'Edit investor':'New investor',wide:true,submitLabel:isEdit?'Save changes':'Add investor',
    values:existing||{entity_type:'Individual',accredited_status:'Unknown'},
    fields:[
      {name:'entity_type',label:'Investor type',type:'select',options:ENTITY_TYPES,half:true,
        help:'Individuals are entered by first / middle / last name.'},
      // Individual / person name fields.
      {name:'first_name',label:'First name',half:true,required:true,showIf:person,placeholder:'e.g. Jane'},
      {name:'middle_name',label:'Middle name',half:true,showIf:person,placeholder:'or initial'},
      {name:'last_name',label:'Last name',half:true,required:true,showIf:person,placeholder:'e.g. Public'},
      // Entity / trust name field.
      {name:'name',label:'Entity / trust name',required:true,showIf:isEntity,placeholder:'e.g. Acme Holdings LLC'},
      {name:'contact_name',label:'Contact person',half:true,showIf:isEntity,help:'Authorized signer / point of contact'},
      {name:'tax_id',label:'SSN / EIN',half:true,placeholder:'Taxpayer ID',help:'SSN for individuals, EIN for entities.'},
      {name:'email',label:'Email',type:'email',half:true},
      {name:'phone',label:'Phone',type:'tel',half:true},
      {name:'accredited_status',label:'Accredited status',type:'select',options:ACCREDITED_STATUSES,half:true},
      {name:'accredited_verified_date',label:'Verified on',type:'date',half:true,
        showIf:v=>v.accredited_status==='Verified'||v.accredited_status==='Self-certified'},
      {name:'accreditation_basis',label:'Established by',type:'select',half:true,
        options:['',...ACCREDITATION_BASES],
        showIf:v=>v.accredited_status==='Verified'||v.accredited_status==='Self-certified',
        help:'The status says whether. This says what the file would show if anyone asked.'},
      {name:'accredited_evidence_date',label:'Evidence dated',type:'date',half:true,
        showIf:v=>v.accredited_status==='Verified'||v.accredited_status==='Self-certified',
        help:`The date on the letter or statement relied on. Flagged once it is more than ${ACCREDITATION_STALE_DAYS} days old.`},
      {name:'address',label:'Address',type:'textarea',rows:2},
      {name:'state',label:'State',type:'select',half:true,
        options:[{value:'',label:'— Not recorded —'},...US_STATES.map(c=>({value:c,label:`${c} — ${stateName(c)}`}))],
        help:'Decides which state notice filings an offering this holder subscribes to will need.'},
      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{const saved=isEdit?await api.updateInvestor(existing.id,v):await api.createInvestor(v);
      toast(isEdit?'Investor updated.':'Investor added.','success');onDone?.(saved);}});
}
function openSubscriptionForm(offering,investors,existing,onDone){
  const offeringId=typeof offering==='object'?offering.id:offering;
  const o=typeof offering==='object'?offering:(db.offerings.find(x=>x.id===Number(offeringId))||{});
  const isEdit=!!existing;
  const tranches=Array.isArray(o.tranches)?o.tranches:[];
  const costLabel=(inherited(scopeFor({offering:o}),'costs_label')||'Legal / professional costs')+' (passed through)';
  // Price per unit resolves through the tranche, then the offering.
  const unitPrice=inherited(scopeFor({offering:o,tranche:existing&&existing.tranche_id?tranches.find(t=>t.id===existing.tranche_id):(tranches.length===1?tranches[0]:null)}),'price_per_unit_cents');
  // If the money is already in escrow, say so rather than asking for the date twice.
  const esc=existing&&existing.investor_id?investorEscrow(offeringId,existing.investor_id):null;
  const fundedHint=esc&&esc.fundedDate?`${money(esc.clearedDeposits)} cleared escrow on ${fmtDate(esc.fundedDate)}.`:null;
  formModal({title:isEdit?'Edit subscription':'Add investor to offering',wide:true,submitLabel:isEdit?'Save changes':'Add',
    values:existing?{investor_id:existing.investor_id,amount_committed:centsToInput(existing.amount_committed_cents),
      costs:centsToInput(existing.costs_cents),tranche_id:existing.tranche_id??'',units:existing.units??'',
      status:existing.status,sub_sent_date:existing.sub_sent_date,sub_signed_date:existing.sub_signed_date,
      funded_date:existing.funded_date,notes:existing.notes}
      // A new subscription opens on the offering's own minimum, in its only
      // tranche if it has one. Both are editable; neither has to be looked up.
      :{status:'Prospect',
        tranche_id:tranches.length===1?tranches[0].id:'',
        amount_committed:centsToInput(inherited(scopeFor({offering:o,tranche:tranches.length===1?tranches[0]:null}),'min_investment_cents'))},
    fields:[
      {name:'investor_id',label:'Investor',required:true,type:'custom',
        build:val=>investorPicker(investors,val,{allowCreate:true}),
        help:'Start typing a name. If they are not in the contact book yet, you can add them from here.'},
      tranches.length?{name:'tranche_id',label:'Tranche',type:'select',half:true,
        options:[{value:'',label:'— No specific tranche —'},...tranches.map(t=>({value:t.id,label:t.name}))],
        help:'Tranches may carry their own terms.'}:null,
      {name:'amount_committed',label:'Amount committed (investment)',type:'money',half:true},
      o.pass_through_costs?{name:'costs',label:costLabel,type:'money',half:true,
        help:'Fees the investor pays on top of the investment amount.'}:null,
      {name:'units',label:'Units',type:'number',half:true,step:'any',
        help:unitPrice?`Calculated at ${money(unitPrice)} a unit — override it if the allotment differs.`:'Set a price per unit on the offering and this fills itself.',
        onChange:(v,f)=>{
          // Recompute only when the amount or the tranche moved. Redrawing the
          // form must not refill a field the user has just cleared.
          if(f.changed&&f.changed!=='amount_committed'&&f.changed!=='tranche_id')return;
          // The price belongs to the tranche picked NOW — switching tranches
          // mid-form must not keep deriving from the old one.
          const tr=tranches.find(t=>t.id===Number(v.tranche_id))||null;
          const derived=derivedUnits({amount_committed_cents:dollarsToCents(v.amount_committed)},
            scopeFor({offering:o,tranche:tr}));
          if(derived!=null&&!v.units)f.setValue('units',derived);}},
      {name:'status',label:'Status',type:'select',options:SUBSCRIPTION_STATUSES,half:true,
        help:'Set by the dates below as you fill them in. Withdrawn is the only one you choose outright.'},
      {name:'sub_sent_date',label:'Sub agreement sent',type:'date',half:true,
        onChange:(v,f)=>{
          if(f.changed&&!['sub_sent_date','sub_signed_date','funded_date'].includes(f.changed))return;
          const d=derivedSubStatus({status:v.status,sub_sent_date:v.sub_sent_date,
            sub_signed_date:v.sub_signed_date,funded_date:v.funded_date});
          if(v.status!=='Withdrawn'&&(SUB_STATUS_RANK[d]??0)>(SUB_STATUS_RANK[v.status]??0))f.setValue('status',d);}},
      {name:'sub_signed_date',label:'Sub agreement signed',type:'date',half:true},
      {name:'funded_date',label:'Funded date',type:'date',half:true,
        help:fundedHint||'Certificate numbers are issued in funding-date order.'},
      {name:'notes',label:'Notes',type:'textarea'}].filter(Boolean),
    onSubmit:async v=>{if(isEdit)await api.updateSubscription(existing.id,v);else await api.createSubscription(offeringId,v);
      toast(isEdit?'Subscription updated.':'Investor added to offering.','success');onDone?.();}});
}
function openEscrowForm(offeringId,investors,existing,onDone){
  const isEdit=!!existing;
  const o=db.offerings.find(x=>x.id===Number(offeringId))||{};
  // Subscribers on this offering are who a deposit almost always belongs to.
  const subscriberIds=db.subscriptions.filter(s=>s.offering_id===Number(offeringId)).map(s=>s.investor_id);
  // Live help under the Investor field: what this person subscribed for and
  // what has already come in, so the amount does not have to be looked up.
  const context=el('div',{class:'field-note'});
  function describe(investorId){
    clear(context);
    const sub=investorId?subscriptionFor(offeringId,investorId):null;
    if(!sub){if(investorId)context.appendChild(el('span',{},'Not a subscriber on this offering yet.'));return null;}
    const e=investorEscrow(offeringId,sub.investor_id,sub.id);
    const due=subscriptionDue(sub,o),got=e.deposits-e.refunds,left=Math.max(0,due-got);
    context.appendChild(el('span',{},
      `Subscribed ${money(due)}`,
      got?` · ${money(got)} received`:' · nothing received yet',
      left?` · ${money(left)} outstanding`:' · fully funded'));
    return{sub,left,due};
  }
  formModal({title:isEdit?'Edit escrow entry':'New escrow entry',submitLabel:isEdit?'Save changes':'Add entry',
    values:existing?{txn_type:existing.txn_type,investor_id:existing.investor_id??'',amount:centsToInput(existing.amount_cents),
      txn_date:existing.txn_date,method:existing.method,reference:existing.reference,cleared:existing.cleared?'yes':'no',notes:existing.notes}
      // A new entry opens as a deposit, dated today, by whatever method the
      // last deposit on this offering used.
      :{txn_type:'deposit',cleared:'no',txn_date:defaultDate(),method:lastEscrowMethod(offeringId)||''},
    fields:[
      {name:'txn_type',label:'Type',type:'select',options:TXN_TYPES,half:true},
      {name:'amount',label:'Amount',type:'money',required:true,half:true},
      {name:'investor_id',label:'Investor',type:'custom',half:true,
        build:val=>investorPicker(investors,val,{preferred:subscriberIds,allowCreate:true,
          onPick:i=>{
            const info=describe(i.id);
            // Fill a blank amount with what is still outstanding. An amount
            // already typed is left exactly as typed.
            const amt=document.getElementById('f_amount');
            if(info&&info.left&&amt&&!amt.value)amt.value=(info.left/100).toFixed(2);
          }}),
        help:'Deposits and refunds belong to an investor; releases and fees do not.'},
      {name:'txn_date',label:'Date',type:'date',half:true},
      {name:'method',label:'Method',type:'select',options:['',...PAYMENT_METHODS],half:true},
      {name:'cleared',label:'Cleared at bank?',type:'select',options:[{value:'no',label:'Pending'},{value:'yes',label:'Cleared'}],half:true,
        help:'Only cleared deposits count towards the minimum raise.'},
      {name:'reference',label:'Reference / check #',half:true,mono:true},
      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{
      const sub=v.investor_id?subscriptionFor(offeringId,v.investor_id):null;
      const payload={...v,cleared:v.cleared==='yes',subscription_id:sub?sub.id:null};
      if(isEdit)await api.updateEscrow(existing.id,payload);else await api.createEscrow(offeringId,payload);
      toast('Escrow entry saved.','success');onDone?.();}});
  // Place the running context under the investor row and prime it.
  const row=document.getElementById('f_amount');
  const invRow=document.querySelector('#modal-root .form-row .ac-wrap');
  if(invRow&&invRow.parentElement)invRow.parentElement.appendChild(context);
  if(existing&&existing.investor_id)describe(existing.investor_id);
}

