/* ============================================================================
   BRINGING AN EXISTING DEAL IN

   Adopting the app for a live offering meant twenty subscribers entered
   through twenty modal dialogs — a cost paid at exactly the moment a new user
   is deciding whether the app is worth it.

   Paste a block instead. One holder per line; a comma, tab or semicolon
   separates the fields. What the app makes of each line is shown before
   anything is written, because a name split the wrong way is worse than a
   name not entered.
   ========================================================================== */
// Columns are recognised by what they look like rather than by position, so a
// pasted spreadsheet does not have to be rearranged first.
function readContactLine(line){
  const parts=line.split(/[\t;,]/).map(x=>x.trim()).filter((x,i,a)=>x!==''||i<a.length-1);
  const out={raw:line,email:null,phone:null,state:null,tax_id:null,name:null,notes:[]};
  const rest=[];
  for(const p of parts){
    if(!p)continue;
    if(!out.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)){out.email=p;continue;}
    if(!out.tax_id&&/^\d{3}-?\d{2}-?\d{4}$|^\d{2}-?\d{7}$/.test(p)){out.tax_id=p;continue;}
    if(!out.phone&&/^[+(]?[\d][\d\s().-]{6,}$/.test(p)){out.phone=p;continue;}
    if(!out.state&&US_STATES.includes(p.toUpperCase())&&p.length===2){out.state=p.toUpperCase();continue;}
    rest.push(p);
  }
  out.name=rest.shift()||null;
  out.notes=rest;
  if(!out.name)return null;
  const entity_type=guessEntityType(out.name);
  const body=isPersonType(entity_type)?{entity_type,...splitPersonName(out.name)}:{entity_type,name:out.name};
  return{...out,entity_type,body:{...body,email:out.email,phone:out.phone,state:out.state,tax_id:out.tax_id,
    notes:out.notes.length?out.notes.join(' · '):null}};
}
function parseContactBlock(text){
  return String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    .map(readContactLine).filter(Boolean);
}
// A contact already on file, matched the way the duplicate check matches them.
function existingContact(row){
  const email=row.email&&String(row.email).toLowerCase();
  const tax=row.tax_id&&String(row.tax_id).replace(/\D/g,'');
  return db.investors.find(i=>
    (email&&String(i.email||'').toLowerCase()===email)||
    (tax&&String(i.tax_id||'').replace(/\D/g,'')===tax)||
    (row.body.name&&String(i.name||'').toLowerCase()===String(row.body.name).toLowerCase())||
    (row.body.last_name&&String(i.last_name||'').toLowerCase()===String(row.body.last_name||'').toLowerCase()
      &&String(i.first_name||'').toLowerCase()===String(row.body.first_name||'').toLowerCase()))||null;
}
function openContactImport(onDone){
  const input=el('textarea',{class:'inline-input',rows:7,
    placeholder:'Jane Q Public, jane@example.com, MI\nAcme Holdings LLC, 38-1234567, contact@acme.test\nRooke Family Trust, OH'});
  const preview=el('div',{});
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  let rows=[];
  function redraw(){
    rows=parseContactBlock(input.value);
    // Matched against the book here, and only here: doing it in the input
    // handler and re-parsing in redraw threw the matches away again.
    rows.forEach(r=>{r.existing=existingContact(r);});
    clear(preview);
    if(!rows.length){
      preview.appendChild(el('p',{class:'field-help'},'Paste one holder per line. Fields may be separated by commas, tabs or semicolons, in any order — an email, a taxpayer number, a telephone number and a two-letter state are recognised by their shape, and whatever is left is the name.'));
      return;
    }
    const dupes=rows.filter(r=>r.existing).length;
    preview.appendChild(dataTable([
      {label:'Name',primary:true,render:r=>[
        el('span',{},r.existing?investorDisplayName(r.existing):(isPersonType(r.entity_type)
          ?[r.body.first_name,r.body.middle_name,r.body.last_name].filter(Boolean).join(' ')
          :r.body.name)),
        el('div',{class:'cell-sub'},r.existing?'Already in the contact book — will be left alone':r.entity_type)]},
      {label:'Email',hide:true,render:r=>r.email||'—'},
      {label:'Phone',hide:true,render:r=>r.phone||'—'},
      {label:'State',render:r=>r.state||'—'},
      {label:'SSN / EIN',hide:true,cls:'mono',render:r=>r.tax_id?fmtTaxId(r.tax_id):'—'},
      {label:'',render:r=>r.existing?pill('Existing','muted'):pill('New','success')}
    ],rows,{caption:'What will be added'}));
    preview.appendChild(el('p',{class:'field-help',style:'margin:10px 0 0'},
      `${rows.length-dupes} to add`+(dupes?`, ${dupes} already on file and left alone`:'')
      +'. A name that looks like an entity is filed as one; a personal name is split into first, middle and last. Correct anything afterwards on the contact itself.'));
  }
  input.addEventListener('input',redraw);
  redraw();
  const submit=el('button',{class:'btn btn-primary',type:'submit'},'Add them');
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    const fresh=rows.filter(r=>!r.existing);
    if(!fresh.length){errorBox.textContent='Nothing here to add.';errorBox.style.display='';return;}
    submit.disabled=true;submit.textContent='Adding…';
    let made=0,failed=0;
    for(const r of fresh){
      try{await api.createInvestor(r.body);made++;}catch{failed++;}
    }
    closeModal();
    toast(failed?`${made} added; ${failed} could not be.`:`${made} contact${made===1?'':'s'} added.`,
      failed?'error':'success');
    onDone?.();
  }},
    errorBox,
    el('div',{class:'form-row'},el('label',{for:'import-block'},'One holder per line'),input),
    el('div',{class:'form-row'},preview),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
      submit));
  input.id='import-block';
  openShell('Add several contacts at once',form,{wide:true});
  setTimeout(()=>input.focus(),40);
}

