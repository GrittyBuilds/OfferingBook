/* ============================================================================
   COMMAND PALETTE — Ctrl/Cmd-K. The whole record, one keystroke away.
   ========================================================================== */
let cmdOpen=false;
function paletteIndex(){
  const items=[];
  for(const o of db.offerings)items.push({group:'Offerings',icon:'file',label:o.name,
    sub:[o.issuer_name,o.status].filter(Boolean).join(' · '),
    text:`${o.name} ${o.issuer_name||''}`.toLowerCase(),
    run:()=>navigate(`/offerings/${o.id}`)});
  for(const i of db.investors)items.push({group:'Investors',icon:'file',label:investorListName(i),
    sub:i.entity_type||'',
    text:`${investorDisplayName(i)} ${investorListName(i)} ${i.email||''}`.toLowerCase(),
    run:()=>navigate(`/investors/${i.id}`)});
  items.push(
    {group:'Go to',icon:'chevron',label:'Dashboard',text:'dashboard home',run:()=>navigate('/')},
    {group:'Go to',icon:'chevron',label:'Offerings',text:'offerings deals raises',run:()=>navigate('/offerings')},
    {group:'Go to',icon:'chevron',label:'Investors',text:'investors contacts people',run:()=>navigate('/investors')},
    {group:'Go to',icon:'chevron',label:'Settings',text:'settings firm defaults counterparties checklist',run:()=>navigate('/settings')},
    {group:'Actions',icon:'plus',label:'New record',sub:'Offering, investor, deposit, closing…',
      text:'new record add create quick offering investor subscription escrow deposit closing certificate',run:()=>openQuickAdd()},
    {group:'Actions',icon:'download',label:'Save a copy of your data',text:'save copy backup download export',run:()=>downloadCopy()},
    {group:'Actions',icon:'swap',label:'Switch appearance',sub:'Light / dark',
      text:'theme dark light appearance mode switch',
      run:()=>applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark')});
  for(const o of db.offerings)items.push({group:'Actions',icon:'print',label:`Print summary — ${o.name}`,
    text:`print summary report ${o.name}`.toLowerCase(),run:()=>printOfferingSummary(o.id)});
  return items;
}
function closePalette(){const root=document.getElementById('cmd-root');clear(root);cmdOpen=false;}
function openPalette(){
  if(cmdOpen){closePalette();return;}
  cmdOpen=true;
  const items=paletteIndex();
  let active=0,shown=[];
  const input=el('input',{class:'cmd-input',type:'text',placeholder:'Search records, or type an action…',
    'aria-label':'Search records and actions',autocomplete:'off',spellcheck:'false'});
  const list=el('div',{class:'cmd-list',role:'listbox'});
  const run=item=>{closePalette();item.run();};
  function draw(){
    const q=input.value.trim().toLowerCase();
    // Every term must appear; order does not matter. "river closing" finds
    // "Print summary — Riverfront Partners Fund I".
    const terms=q.split(/\s+/).filter(Boolean);
    shown=(!terms.length?items.slice(0,14)
      :items.filter(x=>terms.every(t=>x.text.includes(t)||x.label.toLowerCase().includes(t))).slice(0,14));
    active=Math.min(active,Math.max(0,shown.length-1));
    clear(list);
    if(!shown.length){list.appendChild(el('div',{class:'cmd-empty'},'Nothing on record matches.'));return;}
    let lastGroup=null;
    shown.forEach((x,idx)=>{
      if(x.group!==lastGroup){lastGroup=x.group;list.appendChild(el('div',{class:'cmd-group'},x.group));}
      list.appendChild(el('button',{class:'cmd-item'+(idx===active?' active':''),type:'button',role:'option',
        'aria-selected':idx===active?'true':'false',
        onmousedown:e=>{e.preventDefault();run(x);},
        onmousemove:()=>{if(active!==idx){active=idx;draw();}}},
        el('span',{class:'ic'},'@icon:'+x.icon),
        el('span',{},x.label),
        x.sub?el('span',{class:'cmd-item-sub'},x.sub):null));
    });
    const el_=list.querySelector('.cmd-item.active');
    if(el_)el_.scrollIntoView({block:'nearest'});
  }
  input.addEventListener('input',()=>{active=0;draw();});
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,shown.length-1);draw();}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);draw();}
    else if(e.key==='Enter'){e.preventDefault();if(shown[active])run(shown[active]);}
    else if(e.key==='Escape'){e.stopPropagation();closePalette();}
  });
  const root=document.getElementById('cmd-root');
  root.appendChild(el('div',{class:'cmd-backdrop',onclick:e=>{if(e.target===e.currentTarget)closePalette();}},
    el('div',{class:'cmd',role:'dialog','aria-modal':'true','aria-label':'Search and commands'},
      input,list,
      el('div',{class:'cmd-foot'},
        el('span',{},el('kbd',{},'↑'),' ',el('kbd',{},'↓'),' choose'),
        el('span',{},el('kbd',{},'Enter'),' open'),
        el('span',{},el('kbd',{},'Esc'),' close')))));
  draw();
  input.focus();
}
// The shortcut map. Nothing fires while a field, a dialog or the palette has
// the keyboard.
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
    // Not over an open dialog: a form half filled in owns the keyboard, and
    // one Escape would otherwise close the palette and the form together.
    if(escHandler)return;
    e.preventDefault();openPalette();return;}
  if(cmdOpen||escHandler)return;
  const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const keys={'/':()=>openPalette(),n:()=>openQuickAdd(),
    g:null, d:()=>navigate('/'),o:()=>navigate('/offerings'),i:()=>navigate('/investors'),s:()=>navigate('/settings')};
  const fn=keys[e.key.toLowerCase()];
  if(fn){e.preventDefault();fn();}
});

