/* ============================================================================
   SETTINGS — the firm's own constants, and the directory of counterparties.
   ========================================================================== */
async function renderSettings(){
  const cfg=settings();
  const wrap=el('div',{class:'view-settings'});
  const redraw=()=>refresh();

  const editFirm=()=>formModal({title:'Firm details',wide:true,submitLabel:'Save',
    values:{firm_name:cfg.firm_name,firm_address:cfg.firm_address,firm_contact:cfg.firm_contact,report_footer:cfg.report_footer},
    fields:[
      {name:'firm_name',label:'Firm name',placeholder:'e.g. Seyburn Law PLLC',help:'Appears on the letterhead of every printed summary.'},
      {name:'firm_contact',label:'Contact line',half:true,placeholder:'Telephone or email'},
      {name:'firm_address',label:'Address',type:'textarea',rows:2},
      {name:'report_footer',label:'Report footer',type:'textarea',rows:3,
        help:'The sentence that travels with anything you hand a client. Read it and change it if it should say something else.'}],
    onSubmit:async v=>{await api.saveSettings({...cfg,...v});toast('Firm details saved.','success');redraw();}});

  const editDefaults=()=>formModal({title:'Defaults for new offerings',wide:true,submitLabel:'Save',
    values:{default_exemption:cfg.default_exemption,default_security_type:cfg.default_security_type,
      default_return_rate:cfg.default_return_rate??'',default_costs_label:cfg.default_costs_label,
      default_min_investment:centsToInput(cfg.default_min_investment_cents),
      default_escrow_party_id:cfg.default_escrow_party_id??'',
      automation:cfg.automation,mask_account_numbers:cfg.mask_account_numbers,date_defaults:cfg.date_defaults,
      default_accrual_convention:cfg.default_accrual_convention||'simple/365',
      default_cert_prefix:(cfg.default_cert_number_format&&cfg.default_cert_number_format.prefix)||'',
      default_cert_pad:(cfg.default_cert_number_format&&cfg.default_cert_number_format.pad)||1},
    fields:[
      {name:'default_exemption',label:'Exemption',type:'select',options:['',...EXEMPTIONS],half:true,
        help:'Every new offering starts here.'},
      {name:'default_security_type',label:'Security type',type:'select',options:['',...SECURITY_TYPES],half:true},
      {name:'default_return_rate',label:'Preferred return / interest rate (%)',type:'number',step:'any',half:true},
      {name:'default_min_investment',label:'Minimum investment',type:'money',half:true},
      {name:'default_costs_label',label:'Label for pass-through costs',half:true,placeholder:'e.g. Legal & professional fees'},
      {name:'default_escrow_party_id',label:'Usual escrow agent',type:'select',half:true,
        options:[{value:'',label:'— None —'},...partiesByRole('Escrow agent').map(x=>({value:x.id,label:x.name}))],
        help:'Its bank and account fill in with it.'},
      {name:'automation',label:'Suggestions',type:'select',half:true,
        options:[{value:'propose',label:'Propose changes I can accept'},{value:'off',label:'Off'}],
        help:'Nothing is ever written without you pressing Accept.'},
      {name:'date_defaults',label:'Open date fields on today',type:'checkbox'},
      {name:'mask_account_numbers',label:'Mask escrow account numbers in printed reports',type:'checkbox'},
      {name:'default_accrual_convention',label:'Preferred return accrues',type:'select',half:true,
        options:ACCRUAL_CONVENTIONS.map(c=>({value:c.value,label:c.label})),
        help:'An offering may override this. Certificates keep the convention they were issued under.'},
      {name:'default_cert_prefix',label:'Certificate number prefix',half:true,mono:true,placeholder:'e.g. A-',
        help:'What new offerings start from.'},
      {name:'default_cert_pad',label:'Digits',type:'number',step:'1',half:true,placeholder:'1'}],
    onSubmit:async v=>{await api.saveSettings({...cfg,...v});toast('Defaults saved.','success');redraw();}});

  const editChecklist=()=>{
    const items=(cfg.checklist_template&&cfg.checklist_template.length?cfg.checklist_template:DEFAULT_CHECKLIST).slice();
    const list=el('div',{class:'class-rows'});
    const draw=()=>{clear(list);
      items.forEach((label,idx)=>list.appendChild(el('div',{class:'class-row'},
        el('input',{class:'inline-input',value:label,oninput:e=>items[idx]=e.target.value}),
        iconButton('trash','Remove this step',()=>{items.splice(idx,1);draw();},{danger:true}))));};
    draw();
    const body=el('div',{class:'modal-body'},
      el('p',{class:'field-help'},'Every new offering starts from this list. Changing it here does not disturb offerings already on record. Steps with a “the record can prove this” badge keep their proof only while their wording stays exactly as written.'),
      list,
      el('div',{style:'display:flex;gap:8px;margin-top:12px'},
        el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{items.push('');draw();}},'@icon:plus','Add a step'),
        el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:()=>{items.length=0;DEFAULT_CHECKLIST.forEach(x=>items.push(x));draw();}},'Restore the standard list')),
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
        el('button',{class:'btn btn-primary',type:'button',onclick:async()=>{
          await api.saveSettings({...cfg,checklist_template:items.map(s=>String(s).trim()).filter(Boolean)});
          closeModal();toast('Checklist template saved.','success');redraw();}},'Save')));
    openShell('Checklist template',body,{wide:true});
  };

  const editParty=(existing)=>formModal({title:existing?'Edit '+existing.name:'New counterparty',wide:true,
    submitLabel:existing?'Save changes':'Add',
    values:existing||{role:'Issuer'},
    fields:[
      {name:'role',label:'Role',type:'select',options:PARTY_ROLES,half:true},
      {name:'name',label:'Name',required:true,half:true,placeholder:'As it should read on documents'},
      {name:'legal_name',label:'Full legal name',placeholder:'If different from the above'},
      {name:'entity_form',label:'Entity form',half:true,placeholder:'e.g. Delaware LLC'},
      {name:'state_of_organization',label:'State of organisation',half:true},
      {name:'tax_id',label:'EIN',half:true,mono:true},
      {name:'contact_name',label:'Contact',half:true},
      {name:'email',label:'Email',type:'email',half:true},
      {name:'phone',label:'Phone',type:'tel',half:true},
      {name:'bank_name',label:'Bank',half:true,showIf:v=>v.role==='Escrow agent',
        help:'Fills in with the agent when you pick it on an offering.'},
      {name:'account_number',label:'Account #',half:true,mono:true,showIf:v=>v.role==='Escrow agent'},
      {name:'address',label:'Address',type:'textarea',rows:2},
      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{await api.saveParty(v,existing?existing.id:null);
      toast(existing?'Saved.':'Added to the directory.','success');redraw();}});

  const parties=await api.listParties();
  const activity=await api.listActivity(null,25);
  const generations=await api.listGenerations();
  const dropped=activityDropped();
  const dismissedCount=Object.keys(db.dismissed||{}).length;

  const kv=(k,v)=>[k,v||el('span',{class:'muted-text'},'Not set')];

  wrap.appendChild(pageHeader('Settings',{inBar:true,
    subtitle:'Entered once here, and carried into every offering, form and report.'}));

  wrap.appendChild(el('div',{class:'grid-2'},
    el('section',{class:'panel'},
      el('div',{class:'section-head',style:'margin-top:0'},el('h2',{},'The firm'),
        el('button',{class:'btn btn-ghost btn-sm',onclick:editFirm},'Edit')),
      detailGrid([
        kv('Firm name',cfg.firm_name),
        kv('Contact',cfg.firm_contact),
        kv('Address',cfg.firm_address)]),
      el('div',{class:'notes-block'},el('h3',{},'Report footer'),el('p',{},cfg.report_footer))),
    el('section',{class:'panel'},
      el('div',{class:'section-head',style:'margin-top:0'},el('h2',{},'Defaults for new offerings'),
        el('button',{class:'btn btn-ghost btn-sm',onclick:editDefaults},'Edit')),
      detailGrid([
        kv('Exemption',cfg.default_exemption),
        kv('Security type',cfg.default_security_type),
        kv('Preferred return',cfg.default_return_rate!=null?fmtRate(cfg.default_return_rate):null),
        kv('Minimum investment',cfg.default_min_investment_cents!=null?money(cfg.default_min_investment_cents):null),
        kv('Pass-through cost label',cfg.default_costs_label),
        kv('Usual escrow agent',cfg.default_escrow_party_id?(partyById(cfg.default_escrow_party_id)||{}).name:null),
        kv('Suggestions',cfg.automation==='off'?'Off':'Propose changes I can accept'),
        kv('Date fields',cfg.date_defaults?'Open on today':'Open empty'),
        kv('Account numbers in reports',cfg.mask_account_numbers?'Masked':'Shown in full'),
        kv('Preferred return accrues',accrualConvention(cfg.default_accrual_convention).label),
        kv('Certificate numbering',formatCertNumber({cert_number_format:cfg.default_cert_number_format},1)+', '+formatCertNumber({cert_number_format:cfg.default_cert_number_format},2)+', …')]))));

  wrap.appendChild(el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Counterparties'),
        el('div',{class:'section-figures'},el('span',{},'Issuers, escrow agents and counsel — typed once, picked thereafter.'))),
      el('button',{class:'btn btn-primary btn-sm',onclick:()=>editParty(null)},'@icon:plus','Add')),
    !parties.length
      ? emptyState('Nothing in the directory yet. Add the issuer and the escrow agent you use most and they will fill themselves in on every offering.',
          el('button',{class:'btn btn-primary',onclick:()=>editParty(null)},'Add the first'))
      : dataTable([
          {label:'Name',primary:true,render:x=>[el('span',{},x.name),
            x.legal_name&&x.legal_name!==x.name?el('div',{class:'cell-sub'},x.legal_name):null]},
          {label:'Role',render:x=>pill(x.role,PARTY_ROLE_KIND[x.role]||'muted')},
          {label:'Contact',render:x=>x.contact_name||x.email||x.phone||'—'},
          {label:'Bank',hide:true,render:x=>x.bank_name||'—'},
          {label:'Used on',num:true,render:x=>String(db.offerings.filter(o=>o.issuer_party_id===x.id||o.escrow_party_id===x.id).length)},
          {label:'',cls:'row-actions',render:x=>rowActions(
            iconButton('edit',`Edit ${x.name}`,()=>editParty(x)),
            iconButton('trash',`Delete ${x.name}`,async()=>{
              const ok=await confirmDialog(`Delete ${x.name} from the directory?`,{danger:true,confirmLabel:'Delete'});
              if(!ok)return;
              try{await api.deleteParty(x.id);toast('Removed.','success');redraw();}catch(e){toast(e.message,'error');}},{danger:true}))}
        ],parties,{caption:'Counterparty directory'})));

  wrap.appendChild(el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Checklist template'),
        el('div',{class:'section-figures'},el('span',{},`${(cfg.checklist_template&&cfg.checklist_template.length)||DEFAULT_CHECKLIST.length} steps start every new offering`))),
      el('button',{class:'btn btn-ghost btn-sm',onclick:editChecklist},'Edit')),
    el('ul',{class:'template-list'},...((cfg.checklist_template&&cfg.checklist_template.length?cfg.checklist_template:DEFAULT_CHECKLIST)
      .map(t=>el('li',{},t,DEFAULT_CHECKLIST_PROOFS[t]?el('span',{class:'tag',style:'margin-left:8px'},'the record can prove this'):null))))));

  wrap.appendChild(el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'What has changed'),
        el('div',{class:'section-figures'},el('span',{},'Every change the record proposed and you agreed to, and every edit and deletion made by hand.'))),
      dismissedCount?el('button',{class:'btn btn-ghost btn-sm',onclick:async()=>{
        await api.restoreDismissed();toast('Dismissed suggestions restored.','success');redraw();}},
        `Restore ${dismissedCount} dismissed`):null),
    !activity.length?emptyState('Nothing yet.'):
    el('ul',{class:'activity-list'},...activity.map(a=>el('li',{class:'activity-item'},
      el('span',{class:'activity-kind'},a.kind),
      el('span',{style:'flex:1;min-width:0'},a.summary),
      el('span',{class:'activity-when',title:fmtDateTime(a.at)},fmtDate(a.at))))),
    // What the trail no longer holds. A record that quietly begins in March
    // reads as complete; this one says where it actually starts.
    dropped?el('p',{class:'field-help',style:'margin:12px 0 0'},
      `${dropped.count} earlier ${dropped.count===1?'entry':'entries'}, through ${fmtDateTime(dropped.through)}, are no longer held: the trail keeps the most recent ${ACTIVITY_CAP.toLocaleString('en-US')}.`):null));

  wrap.appendChild(el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Protection'),
        el('div',{class:'section-figures'},el('span',{},'Whether this data can be read by anyone who holds the file.'))),
      ENC_AVAILABLE?el('button',{class:'btn '+(isProtected()?'btn-ghost':'btn-primary')+' btn-sm',
        onclick:isProtected()?openChangePassphrase:openSetPassphrase},
        isProtected()?'Change…':'Set a passphrase…'):null),
    el('div',{class:'protect-state'},
      pill(isProtected()?'Encrypted':'Readable by anyone with the file',isProtected()?'success':'warn'),
      el('p',{class:'field-help',style:'margin:10px 0 0'},isProtected()
        ?'The data file, the copy in this browser and every backup you download are encrypted with AES-GCM under a key derived from your passphrase. The passphrase is not stored anywhere and cannot be recovered — if it is lost, so is the data.'
        :'This file is plain JSON. It holds unmasked Social Security and taxpayer numbers and escrow account numbers in full — masking them in lists does nothing for the file itself. Anyone who can open the file can read them.')),
    isProtected()?el('div',{class:'file-btns',style:'margin-top:12px'},
      el('button',{class:'mini-btn',onclick:downloadCopy},'Save an encrypted copy'),
      el('button',{class:'mini-btn',onclick:openRemovePassphrase},'Remove protection')):null,
    !ENC_AVAILABLE?el('p',{class:'field-help',style:'margin:10px 0 0'},
      'This browser does not offer the cryptography this needs. Opening the same file in a current version of Chrome, Edge, Safari or Firefox will.'):null));

  wrap.appendChild(el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Previous versions'),
        el('div',{class:'section-figures'},el('span',{},'States this document passed through, kept in this browser.')))),
    el('p',{class:'field-help',style:'margin:0 0 14px'},
      'A short ring of earlier states, so a wrong edit can be read back. These live in this browser alongside your records — they are a way to undo, not a backup. For a backup, keep copies of the data file itself.'),
    !generations.length?emptyState('No previous versions held yet.'):
    dataTable([
      {label:'Saved',primary:true,render:g=>fmtDateTime(g.at)},
      {label:'Records',num:true,render:g=>String(g.records??'—')},
      {label:'Size',num:true,hide:true,render:g=>`${Math.round((g.bytes||0)/1024)} kB`},
      {label:'',cls:'row-actions',render:g=>rowActions(
        el('button',{class:'btn btn-ghost btn-sm',onclick:async()=>{
          const ok=await confirmDialog(
            `Replace everything currently loaded with the version saved at ${fmtDateTime(g.at)} — ${g.records} record${g.records===1?'':'s'}, against ${countRecords(db)} now? You can take this back straight afterwards.`,
            {danger:countRecords(db)>(g.records??0),confirmLabel:'Restore that version'});
          if(!ok)return;
          try{await api.restoreGeneration(g.at);toast('Restored.','success',{label:'Undo',run:undoLast});refresh();}
          catch(e){toast(e.message,'error');}}},'Restore'))}
    ],generations,{caption:'Previous versions of this document'})));

  return wrap;
}

/* ---- Setting, changing and removing the passphrase ------------------------
   Typed twice, and the warning is not softened: a lost passphrase is lost
   data, and a person deciding this should be deciding it with that in front
   of them rather than discovering it later. */
function passphraseForm({title,intro,submitLabel,needCurrent,onReady}){
  const current=el('input',{type:'password',class:'inline-input grow',autocomplete:'current-password',placeholder:'Current passphrase'});
  const first=el('input',{type:'password',class:'inline-input grow',autocomplete:'new-password',placeholder:'New passphrase'});
  const again=el('input',{type:'password',class:'inline-input grow',autocomplete:'new-password',placeholder:'Type it again'});
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  const fail=m=>{errorBox.textContent=m;errorBox.style.display='';};
  const submit=el('button',{class:'btn btn-primary',type:'submit'},submitLabel);
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    if(needCurrent){
      // Checked against the key actually in use rather than a remembered
      // string — the key is the only evidence of what the passphrase is.
      if(!cryptoSalt){fail('This data is not protected.');return;}
      if(!(await passphraseMatches(current.value))){fail('That is not the current passphrase.');return;}
    }
    if(first.value!==again.value){fail('The two passphrases do not match.');return;}
    submit.disabled=true;submit.textContent='Working…';
    try{await onReady(first.value);closeModal();}
    catch(err){fail(err.message);submit.disabled=false;submit.textContent=submitLabel;}
  }},
    el('p',{class:'field-help'},intro),
    errorBox,
    needCurrent?el('div',{class:'form-row'},el('label',{},'Current passphrase'),current):null,
    el('div',{class:'form-row'},el('label',{},'New passphrase'),first),
    el('div',{class:'form-row'},el('label',{},'Type it again'),again),
    el('div',{class:'notes-block'},el('p',{},'Muniment does not store this passphrase, cannot hint at it, and cannot recover it. If it is lost, the records are lost with it. Keep it where you keep the rest of the firm’s credentials.')),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
      submit));
  openShell(title,form,{wide:true});
  setTimeout(()=>(needCurrent?current:first).focus(),40);
}
// Does this passphrase open the current document? Sealed with a candidate key
// and read back — the only honest test, and cheap enough at a few bytes.
async function passphraseMatches(candidate){
  if(!cryptoKey||!cryptoSalt)return false;
  try{
    const key=await deriveKey(candidate,cryptoSalt,cryptoIterations);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const probe=new TextEncoder().encode('muniment');
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,probe);
    await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
    return true;
  }catch{return false;}
}
function openSetPassphrase(){
  passphraseForm({
    title:'Protect this data with a passphrase',
    intro:'From the next save onward, the data file, the copy held in this browser and every backup you download are encrypted. Copies already written stay as they are until they are overwritten — save a fresh copy afterwards.',
    submitLabel:'Protect this data',needCurrent:false,
    onReady:async p=>{await api.setPassphrase(p);toast('This data is now encrypted. Save a fresh copy to replace any unprotected backups.','success');refresh();}});
}
function openChangePassphrase(){
  passphraseForm({
    title:'Change the passphrase',
    intro:'The data is re-sealed under the new passphrase from the next save onward. Any copy written before that still opens with the old one.',
    submitLabel:'Change it',needCurrent:true,
    onReady:async p=>{await api.setPassphrase(p);toast('Passphrase changed.','success');refresh();}});
}
async function openRemovePassphrase(){
  const ok=await confirmDialog(
    'Remove the passphrase? From the next save onward this data is written as plain, readable JSON — including unmasked taxpayer numbers and escrow account numbers. Encrypted copies already on disk are unaffected.',
    {danger:true,confirmLabel:'Remove protection'});
  if(!ok)return;
  await api.clearPassphrase();
  toast('Protection removed. This data is now written in the clear.','error');
  refresh();
}

/* ---- The More sheet — what the sidebar footer holds on a wider screen ---- */
function openMoreSheet(){
  const cfg=settings();
  const themeNow=document.documentElement.getAttribute('data-theme')==='dark'?'Dark':'Light';
  const body=el('div',{class:'modal-body more-sheet'},
    el('div',{class:'more-row'},
      el('div',{},el('div',{class:'more-label'},'Appearance'),
        el('div',{class:'more-sub'},'Light is the default.')),
      el('button',{class:'btn btn-ghost btn-sm',onclick:e=>{
        applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
        e.target.closest('button').textContent=document.documentElement.getAttribute('data-theme')==='dark'?'Dark':'Light';
      }},themeNow)),
    el('div',{class:'more-row'},
      el('div',{},el('div',{class:'more-label'},'Your data'),
        el('div',{class:'more-sub'},fileName?`Saving to ${fileName}`:'Held in this browser')),
      el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{closeModal();downloadCopy();}},'@icon:download','Save a copy')),
    FSA?el('div',{class:'more-row'},
      el('div',{},el('div',{class:'more-label'},'Data file'),
        el('div',{class:'more-sub'},'Autosaves every change to a file you choose.')),
      el('div',{style:'display:flex;gap:8px'},
        el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{closeModal();newDataFile();}},'New'),
        el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{closeModal();openDataFile();}},'Open'))):
      el('div',{class:'more-row'},
        el('div',{},el('div',{class:'more-label'},'Data file'),
          el('div',{class:'more-sub'},'This browser cannot autosave to a file you choose. Your records are held here and “Save a copy” downloads them.'))),
    el('div',{class:'qa-list',style:'margin-top:14px'},
      el('button',{class:'qa-item',type:'button',onclick:()=>{closeModal();navigate('/settings');}},
        el('span',{class:'qa-item-title'},'Settings'),
        el('span',{class:'qa-item-desc'},'Firm details, defaults, counterparties, checklist')),
      el('button',{class:'qa-item',type:'button',onclick:()=>{closeModal();importFile();}},
        el('span',{class:'qa-item-title'},'Import a data file'),
        el('span',{class:'qa-item-desc'},'Replace everything held here with a saved copy'))));
  openShell('More',body);
}


