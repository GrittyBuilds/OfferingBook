/* ============================================================================
   VIEWS
   ========================================================================== */
async function renderDashboard(){
  const[d,offerings]=await Promise.all([api.dashboard(),api.listOfferings()]);
  const newBtn=el('button',{class:'btn btn-primary',onclick:()=>openOfferingForm(null,o=>navigate(`/offerings/${o.id}`))},'@icon:plus','New offering');
  const showWelcome=!offerings.length&&!db.investors.length;
  return el('div',{class:'view-dashboard'},
    pageHeader('Dashboard',{subtitle:'Your practice at a glance.',actions:[newBtn],inBar:true}),
    showWelcome?welcomePanel():null,
    attentionPanel(),
    suggestionPanel(null,refresh,{limit:5}),
    el('div',{class:'stat-row'},
      statCard('Active offerings',d.activeCount,{sub:`${d.offeringCount} total`}),
      statCard('In escrow (cleared)',moneyShort(d.totalInEscrow),{kind:'accent',sub:'across all offerings'}),
      statCard('Total committed',moneyShort(d.totalCommitted),{sub:'subscribed by investors'}),
      statCard('Investors',d.investorCount,{sub:'in your contact book'}),
      statCard('Min-raise met',d.minRaiseMetCount,{kind:d.minRaiseMetCount?'success':undefined,sub:'offerings cleared to close'})),
    el('div',{class:'dash-cols'},
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Upcoming closings'),
        !d.upcomingClosings.length?emptyState('No closing deadlines set.'):
        el('ul',{class:'closing-list'},...d.upcomingClosings.map(c=>el('li',{class:'closing-item'+(c.days<=14?' urgent':''),onclick:()=>navigate(`/offerings/${c.id}`)},
          el('div',{class:'closing-main'},el('span',{class:'closing-name'},c.name),el('span',{class:'closing-date'},`${fmtDate(c.final_close_date)} · ${relDays(c.days)}`)),
          c.minRaiseMet?pill('Min-raise met','success'):pill('Below min-raise','warn'))))),
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Offerings'),
        !offerings.length?emptyState('No offerings on record.'):
        el('ul',{class:'mini-list'},...offerings.slice(0,8).map(o=>el('li',{class:'mini-item',onclick:()=>navigate(`/offerings/${o.id}`)},
          el('div',{class:'mini-main'},el('span',{class:'mini-name'},o.name),el('span',{class:'mini-meta'},o.issuer_name||'—')),
          el('div',{class:'mini-right'},el('span',{class:'mini-escrow'},money(o.summary.escrow.clearedBalance)),pill(o.status,OFFERING_STATUS_KIND[o.status]||'default'))))))));
}
function welcomePanel(){
  return el('div',{class:'welcome'},el('section',{class:'panel'},
    el('h2',{},'Muniment — nothing on record yet'),
    el('p',{class:'muted-text'},'Muniments of title: the documents by which ownership is proved. Offerings, subscribers, escrow, and certificates are held here — on this computer only. Nothing is transmitted.'),
    FSA?el('div',{},
      el('p',{},'Your data is currently kept in this browser. To store it in a file on your computer (recommended, so you can back it up and move it between machines), connect a data file:'),
      el('div',{class:'welcome-actions'},
        el('button',{class:'btn btn-primary',onclick:newDataFile},'Create a data file…'),
        el('button',{class:'btn btn-ghost',onclick:openDataFile},'Open an existing file…'))):
      el('div',{class:'browser-warn'},IOS
        ?'On an iPhone or iPad your records are kept in this browser and survive closing it. Use “Save a copy” regularly to back them up, and “Import” to restore. Opening this same file on a computer in Chrome or Edge adds autosave to a file you choose.'
        :'This browser doesn’t support saving to a chosen file. Your data is kept in this browser — use “Save a copy” regularly to back it up, and “Import” to restore. For the full experience, open this file in Google Chrome or Microsoft Edge.')));
}

async function renderOfferings(){
  const offerings=await api.listOfferings();
  const newBtn=el('button',{class:'btn btn-primary',onclick:()=>openOfferingForm(null,o=>navigate(`/offerings/${o.id}`))},'@icon:plus','New offering');
  return el('div',{},pageHeader('Offerings',{subtitle:`${offerings.length} offering${offerings.length===1?'':'s'}`,actions:[newBtn],inBar:true}),
    !offerings.length?emptyState('No offerings yet.',el('button',{class:'btn btn-primary',onclick:()=>openOfferingForm(null,o=>navigate(`/offerings/${o.id}`))},'Create your first offering')):
    el('div',{class:'card-grid'},...offerings.map(offeringCard)));
}
function offeringCard(o){
  const s=o.summary,days=s.daysToFinalClose;
  return el('div',{class:'offering-card',onclick:()=>navigate(`/offerings/${o.id}`)},
    el('div',{class:'oc-head'},el('div',{},el('h3',{class:'oc-name'},o.name),el('div',{class:'oc-issuer'},o.issuer_name||'—')),pill(o.status,OFFERING_STATUS_KIND[o.status]||'default')),
    el('div',{class:'oc-tags'},o.exemption?el('span',{class:'tag'},o.exemption):null,o.security_type?el('span',{class:'tag'},o.security_type):null),
    el('div',{class:'oc-escrow'},el('div',{},el('span',{class:'oc-escrow-val'},money(s.escrow.clearedBalance)),el('span',{class:'oc-escrow-lbl'},' in escrow')),
      o.target_min_cents?el('span',{class:`oc-minraise ${s.minRaiseMet?'met':''}`},s.minRaiseMet?'Minimum raise met':`${s.minRaisePct}% of minimum`):null),
    o.target_min_cents?progressBar(s.minRaisePct,{met:s.minRaiseMet}):null,
    el('div',{class:'oc-foot'},el('span',{},`${s.subscriptions.investorCount} investor${s.subscriptions.investorCount===1?'':'s'}`),
      days!==null&&!['Closed','Terminated'].includes(o.status)?el('span',{class:days<=14&&days>=0?'urgent-text':''},`Close ${relDays(days)}`):el('span',{},o.no_deadline?'Open-ended':fmtDate(o.final_close_date))));
}

const TABS=['Overview','Tranches','Investors','Escrow','Closings','Certificates','Distributions','Filings','Checklist','Reconciliation'];
async function renderOffering(id){
  const[offering,investors]=await Promise.all([api.getOffering(id),api.listInvestors()]);
  const state={offering,investors,tab:currentTab()};
  const tabContent=el('div',{class:'tab-content'});
  const tabBar=el('nav',{class:'tab-bar',role:'tablist','aria-label':'Offering sections'},
    ...TABS.map(t=>el('button',{class:'tab'+(t===state.tab?' active':''),type:'button',role:'tab',
      dataset:{tab:t},'aria-selected':t===state.tab?'true':'false',onclick:()=>selectTab(t)},t)));
  function selectTab(t){state.tab=t;history.replaceState(null,'',`#/offerings/${id}`+(t==='Overview'?'':`?tab=${t}`));
    tabBar.querySelectorAll('.tab').forEach(b=>{
      const on=b.dataset.tab===t;
      b.classList.toggle('active',on);
      b.setAttribute('aria-selected',on?'true':'false');
      if(on)b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});});
    drawTab();}
  async function reloadOffering(){state.offering=await api.getOffering(id);
    const nh=buildHeader();header.replaceWith(nh);header=nh;
    const ns=suggestionPanel(id,async()=>{await reloadOffering();drawTab();})||el('div',{});
    strip.replaceWith(ns);strip=ns;}
  async function drawTab(){clear(tabContent);tabContent.appendChild(el('div',{class:'loading'},'Loading…'));
    const render={Overview:()=>overviewTab(state),Tranches:()=>tranchesTab(state,drawTab,reloadOffering),
      Investors:()=>investorsTab(state,drawTab,reloadOffering),
      Escrow:()=>escrowTab(state,drawTab,reloadOffering),Closings:()=>closingsTab(state,drawTab,reloadOffering),
      Certificates:()=>certificatesTab(state,drawTab,reloadOffering),
      Distributions:()=>distributionsTab(state,drawTab,reloadOffering),
      Filings:()=>filingsTab(state,drawTab,reloadOffering),
      Checklist:()=>checklistTab(state,drawTab,reloadOffering),Reconciliation:()=>reconciliationTab(state)}[state.tab];
    const node=await render();clear(tabContent);tabContent.appendChild(node);}
  // A tab that carries its own state — the as-of date on the certificate
  // roster, say — needs a way to draw itself again without losing it.
  state.redrawTab=drawTab;
  let strip=suggestionPanel(id,async()=>{await reloadOffering();drawTab();})||el('div',{});
  let header=buildHeader();
  function buildHeader(){const o=state.offering,s=o.summary;
    return el('div',{},pageHeader(o.name,{back:{href:'#/offerings',label:'All offerings'},subtitle:o.issuer_name||undefined,
      actions:[el('button',{class:'btn btn-ghost',onclick:()=>printOfferingSummary(o.id)},'@icon:print','Print summary'),
        el('button',{class:'btn btn-ghost',onclick:()=>openOfferingForm(o,()=>reloadOffering())},'Edit'),
        el('button',{class:'btn btn-danger-ghost',onclick:()=>deleteOffering(o)},'Delete')]}),
      el('div',{class:'offering-summary-row'},
        el('div',{class:'osr-item'},pill(o.status,OFFERING_STATUS_KIND[o.status]||'default')),
        o.exemption?el('div',{class:'osr-item'},el('span',{class:'tag'},o.exemption)):null,
        el('div',{class:'osr-item'},el('strong',{},money(s.escrow.clearedBalance)),el('span',{class:'muted-text'},' in escrow')),
        o.target_min_cents?el('div',{class:'osr-item'},s.minRaiseMet?pill('Min-raise met','success'):pill(`${s.minRaisePct}% of min-raise`,'warn')):null,
        s.daysToFinalClose!==null&&!['Closed','Terminated'].includes(o.status)?el('div',{class:'osr-item'+(s.daysToFinalClose<=14&&s.daysToFinalClose>=0?' urgent-text':'')},`Closes ${relDays(s.daysToFinalClose)}`):null));}
  async function deleteOffering(o){const ok=await confirmDialog(`Delete “${o.name}” and all its investors-on-offering, escrow entries, checklist and reconciliations? This cannot be undone.`,{danger:true,confirmLabel:'Delete offering'});
    if(!ok)return;
    await withUndo(`deleting the offering “${o.name}”`,()=>api.deleteOffering(o.id),`“${o.name}” deleted.`);
    navigate('/offerings');}
  const root=el('div',{class:'view-offering'},header,strip,tabBar,tabContent);drawTab();return root;
}
function currentTab(){const m=location.hash.match(/[?&]tab=([^&]+)/);const t=m?decodeURIComponent(m[1]):'Overview';return TABS.includes(t)?t:'Overview';}

function overviewTab(state){
  const o=state.offering,s=o.summary;
  return el('div',{class:'grid-2'},
    el('section',{class:'panel'},el('h2',{class:'panel-title'},'Offering details'),
      detailGrid([['Issuer / client',o.issuer_name],['Exemption',o.exemption],['Security type',o.security_type],
        ['Price per unit',o.price_per_unit_cents!=null?money(o.price_per_unit_cents):null],
        ['Minimum investment',minInvestDisplay(o)],
        ['Minimum raise',o.target_min_cents!=null?money(o.target_min_cents):null],
        ['Maximum raise',maxRaiseDisplay(o)],
        ['Launch date',fmtDate(o.launch_date)],
        ['Form D',(()=>{const f=formDPosition(o);
          if(!f)return o.form_d_filed_date?fmtDate(o.form_d_filed_date):null;
          if(f.filed)return el('span',{},fmtDate(f.filed),f.filedLate?el('span',{class:'warn-text'},' — after the deadline'):null);
          if(!f.firstSale)return el('span',{class:'muted-text'},'Due fifteen days after the first sale');
          return el('span',{class:f.overdue?'warn-text':''},`Due ${fmtDate(f.due)} — ${relDays(f.daysLeft)}`);})()],
        ['Bad-actor inquiry',/^Reg D 506/.test(String(o.exemption||''))
          ?(o.bad_actor_checked_date?fmtDate(o.bad_actor_checked_date):el('span',{class:'warn-text'},'Not recorded')):null],
        ['First / interim close',fmtDate(o.first_close_date)],['Final close deadline',closeDeadlineDisplay(o)]]),
      o.notes?el('div',{class:'notes-block'},el('h3',{},'Notes'),el('p',{},o.notes)):null),
    el('div',{},
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Closing readiness'),
        o.target_min_cents?el('div',{},
          el('div',{class:'readiness-figures'},el('span',{},`${money(s.escrow.clearedNetDeposits)} cleared`),el('span',{class:'muted-text'},` of ${money(o.target_min_cents)} minimum`)),
          progressBar(s.minRaisePct,{met:s.minRaiseMet}),
          el('div',{class:'readiness-note'},s.minRaiseMet?pill('Minimum raise met — closing can proceed','success'):pill(`${money(o.target_min_cents-s.escrow.clearedNetDeposits)} more needed to close`,'warn'))):
          el('p',{class:'muted-text'},'Set a minimum raise on this offering to track closing readiness.')),
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Escrow snapshot'),
        el('div',{class:'stat-row compact'},statCard('Cleared balance',money(s.escrow.clearedBalance),{kind:'accent'}),
          statCard('Pending',money(s.escrow.pendingBalance)),statCard('Book balance',money(s.escrow.bookBalance))),
        el('dl',{class:'detail-grid'},el('dt',{},'Escrow agent'),el('dd',{},o.escrow_agent||'—'),
          el('dt',{},'Escrow bank'),el('dd',{},o.escrow_bank||'—'),el('dt',{},'Account #'),el('dd',{},o.escrow_account_number||'—'),
          el('dt',{},'Closings held'),el('dd',{},s.closingsCount?`${s.closingsCount} · ${money(s.totalReleased)} released`:'None yet'))),
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Process'),
        el('div',{class:'progress-inline'},progressBar(s.tasksTotal?Math.round((s.tasksDone/s.tasksTotal)*100):0),
          el('span',{class:'progress-label'},`${s.tasksDone}/${s.tasksTotal} steps done`)))));
}
async function tranchesTab(state,drawTab,reloadOffering){
  const offering=state.offering;
  const tranches=Array.isArray(offering.tranches)?offering.tranches:[];
  const subs=await api.listSubscriptions(offering.id);
  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openTrancheForm(offering,null,async()=>{await reloadOffering();drawTab();})},'@icon:plus','Add tranche');
  const count=id=>subs.filter(s=>s.tranche_id===id&&s.status!=='Withdrawn').length;
  const raised=id=>subs.filter(s=>s.tranche_id===id&&s.status!=='Withdrawn').reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  return el('div',{},
    el('div',{class:'section-head'},el('h2',{},'Tranches'),addBtn),
    el('p',{class:'muted-text',style:'margin:-6px 0 16px'},'Sub-series within this offering. Each tranche may carry its own price, minimums, return rate, class and closing terms. Investors and certificates can be assigned to a tranche.'),
    !tranches.length?emptyState('No tranches yet. The whole offering is treated as a single series until you add one.',
      el('button',{class:'btn btn-primary',onclick:()=>openTrancheForm(offering,null,async()=>{await reloadOffering();drawTab();})},'Add the first tranche')):
    el('div',{class:'card-grid'},...tranches.map(t=>el('div',{class:'panel',style:'margin:0'},
      el('div',{class:'oc-head'},el('div',{},el('h3',{class:'oc-name'},t.name),
        el('div',{class:'oc-issuer'},[t.class_name,t.security_type].filter(Boolean).join(' · ')||'—')),
        el('div',{class:'row-actions'},
          iconButton('edit',`Edit ${t.name}`,()=>openTrancheForm(offering,t,async()=>{await reloadOffering();drawTab();})),
          el('button',{class:'icon-btn danger',title:'Delete',onclick:async()=>{const ok=await confirmDialog(`Delete tranche “${t.name}”? Investors linked to it will be unassigned.`,{danger:true,confirmLabel:'Delete'});if(!ok)return;
            await withUndo(`deleting the tranche “${t.name}”`,()=>api.deleteTranche(offering.id,t.id),`Tranche “${t.name}” deleted.`);
            await reloadOffering();drawTab();}},'@icon:trash'))),
      detailGrid([
        ['Price per unit',t.price_per_unit_cents!=null?money(t.price_per_unit_cents):null],
        ['Minimum investment',t.min_investment_cents!=null?money(t.min_investment_cents):null],
        ['Min / max raise',[t.target_min_cents!=null?money(t.target_min_cents):null,t.target_max_cents!=null?money(t.target_max_cents):null].filter(Boolean).join(' / ')||null],
        ['Return rate',t.default_return_rate!=null?fmtRate(t.default_return_rate):null],
        ['Close date',t.close_date?fmtDate(t.close_date):null],
        ['Investors',`${count(t.id)} · ${money(raised(t.id))} committed`]]),
      t.notes?el('div',{class:'notes-block'},el('p',{},t.notes)):null))));
}
function openTrancheForm(offering,existing,onDone){
  const isEdit=!!existing;
  formModal({title:isEdit?'Edit tranche':'New tranche',wide:true,submitLabel:isEdit?'Save changes':'Add tranche',
    values:existing?{name:existing.name,price_per_unit:centsToInput(existing.price_per_unit_cents),
      min_investment:centsToInput(existing.min_investment_cents),target_min:centsToInput(existing.target_min_cents),
      target_max:centsToInput(existing.target_max_cents),security_type:existing.security_type,class_name:existing.class_name,
      default_return_rate:existing.default_return_rate??'',close_date:existing.close_date,notes:existing.notes}:{},
    fields:[
      {name:'name',label:'Tranche name',required:true,placeholder:'e.g. Tranche 1 / Series A-1'},
      {name:'security_type',label:'Security type',type:'select',options:['',...SECURITY_TYPES],half:true,
        help:offering.security_type?`Blank means ${offering.security_type}, from the offering.`:undefined},
      {name:'class_name',label:'Ownership class',half:true,datalist:(offering.classes||[]).map(c=>c.name),placeholder:'e.g. Class A Units'},
      {name:'price_per_unit',label:'Price per unit',type:'money',half:true,
        placeholder:centsToInput(offering.price_per_unit_cents)||undefined,
        help:offering.price_per_unit_cents!=null?`Blank means ${money(offering.price_per_unit_cents)}, from the offering.`:undefined},
      {name:'min_investment',label:'Minimum investment',type:'money',half:true,
        placeholder:centsToInput(offering.min_investment_cents)||undefined,
        help:offering.min_investment_cents!=null?`Blank means ${money(offering.min_investment_cents)}, from the offering.`:undefined},
      {name:'target_min',label:'Minimum raise',type:'money',half:true},
      {name:'target_max',label:'Maximum raise',type:'money',half:true},
      {name:'default_return_rate',label:'Preferred return / interest rate (%)',type:'number',step:'any',half:true,
        help:offering.default_return_rate!=null?`Blank means ${fmtRate(offering.default_return_rate)}, from the offering.`:undefined},
      {name:'close_date',label:'Tranche close date',type:'date',half:true},
      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{await api.saveTranche(offering.id,v,existing?existing.id:null);
      toast(isEdit?'Tranche updated.':'Tranche added.','success');onDone?.();}});
}
async function investorsTab(state,drawTab,reloadOffering){
  const offering=state.offering;
  const subs=await api.listSubscriptions(offering.id);
  const calls=offering.staged_funding?await api.listCapitalCalls(offering.id):null;
  const refreshTab=async()=>{await reloadOffering();drawTab();};
  const tranches=Array.isArray(offering.tranches)?offering.tranches:[];
  const trancheName=id=>{const t=tranches.find(x=>x.id===id);return t?t.name:null;};
  // Withdrawn rows stay on the roster and out of the figures.
  const live=subs.filter(s=>s.status!=='Withdrawn');
  const committed=live.reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  const costs=live.reduce((a,s)=>a+(s.costs_cents||0),0);
  const showCosts=!!offering.pass_through_costs;
  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openSubscriptionForm(offering,state.investors,null,async()=>{await reloadOffering();drawTab();})},'@icon:plus','Add investor');
  const received=live.reduce((a,s)=>a+Math.max(0,investorEscrow(offering.id,s.investor_id,s.id).clearedNet),0);
  const figures=el('div',{class:'section-figures'},
    el('span',{},el('strong',{},money(committed)),' committed'),
    el('span',{},el('strong',{},money(received)),' received'),
    showCosts?el('span',{},el('strong',{},money(costs)),' costs'):null,
    showCosts?el('span',{},el('strong',{},money(committed+costs)),' total due'):null);
  return el('div',{},
    calls?capitalCallsPanel(offering,calls,refreshTab):null,
    el('div',{class:'section-head'},el('div',{},el('h2',{},'Investors'),figures),
      el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},
        subs.length?el('button',{class:'btn btn-ghost btn-sm',onclick:()=>exportRoster(offering,subs)},'@icon:download','CSV'):null,
        addBtn)),
    !subs.length?emptyState('No investors on this offering yet.',state.investors.length?null:el('a',{class:'btn btn-ghost',onclick:()=>navigate('/investors')},'Add investors to your contact book first')):
    dataTable([
      {label:'Investor',primary:true,sort:s=>s.investor_name,render:s=>[
        el('a',{class:'link',onclick:()=>navigate(`/investors/${s.investor_id}`)},s.investor_name),
        el('div',{class:'cell-sub'},s.email||s.phone||s.entity_type)]},
      {label:'Status',sort:s=>SUB_STATUS_RANK[s.status]??9,render:s=>pill(s.status,SUBSCRIPTION_KIND[s.status]||'muted')},
      {label:'Committed',num:true,sort:s=>s.amount_committed_cents,render:s=>money(s.amount_committed_cents)},
      // What has actually arrived, against what was promised. This is the
      // column a subscription roster is really for, and it was not here.
      {label:'Received',num:true,sort:s=>Math.max(0,investorEscrow(offering.id,s.investor_id,s.id).clearedNet),
        render:s=>{const got=Math.max(0,investorEscrow(offering.id,s.investor_id,s.id).clearedNet);
        const due=subscriptionDue(s,offering);
        return el('span',{class:got>=due&&due>0?'':'muted-text'},money(got));}},
      showCosts?{label:'Costs',num:true,hide:true,render:s=>s.costs_cents?money(s.costs_cents):'—'}:null,
      showCosts?{label:'Total due',num:true,render:s=>money((s.amount_committed_cents||0)+(s.costs_cents||0))}:null,
      {label:'Units',num:true,hide:true,sort:s=>s.units,render:s=>s.units??'—'},
      tranches.length?{label:'Tranche',hide:true,sort:s=>trancheName(s.tranche_id),render:s=>trancheName(s.tranche_id)||'—'}:null,
      {label:'Accredited',hide:true,sort:s=>s.accredited_status,render:s=>pill(s.accredited_status,ACCREDITED_KIND[s.accredited_status]||'muted')},
      {label:'Signed',hide:true,sort:s=>s.sub_signed_date,render:s=>fmtDate(s.sub_signed_date)},
      {label:'',cls:'row-actions',render:s=>rowActions(
        iconButton('edit',`Edit ${s.investor_name}'s subscription`,()=>openSubscriptionForm(offering,state.investors,s,async()=>{await reloadOffering();drawTab();})),
        iconButton('trash',`Remove ${s.investor_name} from this offering`,async()=>{
          const ok=await confirmDialog(`Remove ${s.investor_name} from this offering?`,{danger:true,confirmLabel:'Remove'});
          if(!ok)return;
          await withUndo(`removing ${s.investor_name} from the offering`,()=>api.deleteSubscription(s.id),`${s.investor_name} removed.`);
          await reloadOffering();drawTab();},{danger:true}))}
    ],subs,{caption:`Investors on ${offering.name}`}));
}
async function escrowTab(state,drawTab,reloadOffering){
  const{transactions,summary}=await api.listEscrow(state.offering.id);
  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openEscrowForm(state.offering.id,state.investors,null,async()=>{await reloadOffering();drawTab();})},'@icon:plus','New entry');
  /* A ledger long enough to be worth keeping is too long to read.
     The structural filters — type, cleared, date range — redraw the table,
     because they change what the totals underneath are totals of. The text
     search hides rows in place instead, the way the contact book already
     does: a redraw on every keystroke takes the cursor with it.
     All of it is held on the tab state, so toggling a clearance — which
     redraws the tab — does not throw away the range you were looking at. */
  if(!state.escrowFilter)state.escrowFilter={q:'',type:'',from:'',to:'',cleared:''};
  const f=state.escrowFilter;
  const structural=t=>{
    if(f.type&&t.txn_type!==f.type)return false;
    if(f.cleared==='cleared'&&!t.cleared)return false;
    if(f.cleared==='pending'&&t.cleared)return false;
    if(f.from&&(!t.txn_date||t.txn_date<f.from))return false;
    if(f.to&&(!t.txn_date||t.txn_date>f.to))return false;
    return true;
  };
  const shown=transactions.filter(structural);
  const set=(k,v)=>{f[k]=v;drawTab();};
  const searchText=t=>[t.investor_name,t.method,t.reference,t.notes,t.txn_type,
    fmtDate(t.txn_date),centsToInput(t.amount_cents)].filter(Boolean).join(' ').toLowerCase();
  const clearedIn=rows=>rows.filter(t=>t.cleared)
    .reduce((a,t)=>a+(SIGN[t.txn_type]||0)*(t.amount_cents||0),0);
  const countLine=el('div',{class:'filter-count'});
  const tableWrap=el('div',{});
  function updateCount(rows){
    countLine.textContent=rows.length===transactions.length
      ? `${transactions.length} entr${transactions.length===1?'y':'ies'}`
      : `${rows.length} of ${transactions.length} entries · ${money(clearedIn(rows))} cleared in this selection`;
  }
  // Hides rows that do not match the typed text, and re-counts what is left.
  function applySearch(){
    const q=f.q.trim().toLowerCase();
    const body=tableWrap.querySelector('tbody');
    if(!body){updateCount(shown);return;}
    const live=[];
    for(const tr of body.rows){
      const hit=!q||(tr.dataset.search||'').includes(q);
      tr.style.display=hit?'':'none';
      if(hit&&tr.dataset.idx!=null)live.push(shown[Number(tr.dataset.idx)]);
    }
    updateCount(live);
    const none=tableWrap.querySelector('.filter-none');
    if(none)none.style.display=live.length?'none':'';
  }
  const anyFilter=()=>!!(f.q||f.type||f.from||f.to||f.cleared);
  const clearAll=()=>{state.escrowFilter={q:'',type:'',from:'',to:'',cleared:''};drawTab();};
  const filterRow=transactions.length>1?el('div',{class:'filter-row'},
    el('input',{type:'search',class:'inline-input grow',placeholder:'Search the ledger…',
      'aria-label':'Search the escrow ledger',value:f.q,
      oninput:e=>{f.q=e.target.value;applySearch();}}),
    el('select',{class:'inline-input','aria-label':'Entry type',onchange:e=>set('type',e.target.value)},
      el('option',{value:'',selected:!f.type},'Every type'),
      ...TXN_TYPES.map(t=>el('option',{value:t.value,selected:f.type===t.value},t.label.split(' — ')[0]))),
    el('select',{class:'inline-input','aria-label':'Cleared or pending',onchange:e=>set('cleared',e.target.value)},
      el('option',{value:'',selected:!f.cleared},'Cleared and pending'),
      el('option',{value:'cleared',selected:f.cleared==='cleared'},'Cleared only'),
      el('option',{value:'pending',selected:f.cleared==='pending'},'Pending only')),
    el('label',{class:'filter-dates'},el('span',{},'From'),
      el('input',{type:'date',class:'inline-input date',value:f.from,onchange:e=>set('from',e.target.value)}),
      el('span',{},'to'),
      el('input',{type:'date',class:'inline-input date',value:f.to,onchange:e=>set('to',e.target.value)})),
    anyFilter()?el('button',{class:'btn btn-ghost btn-sm',onclick:clearAll},'Clear'):null):null;

  const view=el('div',{class:'escrow-wrap'},
    el('div',{class:'stat-row'},statCard('Cleared balance',money(summary.clearedBalance),{kind:'accent',sub:'settled at bank'}),
      statCard('Pending',money(summary.pendingBalance),{sub:'not yet cleared'}),statCard('Deposits',money(summary.deposits),{kind:'success'}),
      statCard('Out (release/refund/fee)',money(summary.releases+summary.refunds+summary.fees),{sub:`${money(summary.releases)} released`})),
    el('div',{class:'section-head'},el('h2',{},'Escrow ledger'),
      el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},
        shown.length?el('button',{class:'btn btn-ghost btn-sm',onclick:()=>exportEscrow(state.offering,shown)},'@icon:download','CSV'):null,
        addBtn)),
    filterRow,
    transactions.length?countLine:null,
    !transactions.length?emptyState('No escrow activity recorded yet.'):
    !shown.length?emptyState('Nothing in the ledger matches that.',
      el('button',{class:'btn btn-ghost',onclick:clearAll},'Clear the filter')):
    tableWrap);
  if(shown.length){
    tableWrap.appendChild(dataTable([
      {label:'Entry',primary:true,sort:t=>t.investor_name,render:t=>[
        el('span',{},t.investor_name||(t.txn_type==='release'?'Release to issuer':t.txn_type==='fee'?'Fee or expense':'—')),
        el('div',{class:'cell-sub'},fmtDate(t.txn_date))]},
      {label:'Date',hide:true,sort:t=>t.txn_date,render:t=>fmtDate(t.txn_date)},
      {label:'Type',sort:t=>t.txn_type,render:t=>pill(t.txn_type.charAt(0).toUpperCase()+t.txn_type.slice(1),TXN_KIND[t.txn_type]||'muted')},
      {label:'Method / ref',hide:true,render:t=>[t.method,t.reference?el('span',{class:'mono'},t.reference):null].filter(Boolean).length
        ?[t.method||'',t.method&&t.reference?' · ':'',t.reference?el('span',{class:'mono'},t.reference):null]:'—'},
      {label:'Cleared',render:t=>el('button',{class:`clear-toggle ${t.cleared?'on':''}`,type:'button',
        'aria-pressed':t.cleared?'true':'false',
        'aria-label':`${t.cleared?'Cleared':'Pending'} — press to mark ${t.cleared?'pending':'cleared'}`,
        onclick:async()=>{
          await api.updateEscrow(t.id,{txn_type:t.txn_type,investor_id:t.investor_id,subscription_id:t.subscription_id,
            amount:(t.amount_cents/100).toFixed(2),txn_date:t.txn_date,method:t.method,reference:t.reference,
            cleared:!t.cleared,notes:t.notes});
          await reloadOffering();drawTab();}},t.cleared?'Cleared':'Pending')},
      // Sorted by what the entry does to the balance, so the biggest movements
      // gather at one end rather than deposits and refunds interleaving.
      {label:'Amount',num:true,sort:t=>(SIGN[t.txn_type]||0)*(t.amount_cents||0),
        render:t=>{const outbound=t.txn_type!=='deposit';
        return el('span',{class:outbound?'neg':'pos'},(outbound?'\u2212':'+')+money(t.amount_cents));}},
      {label:'',cls:'row-actions',render:t=>rowActions(
        iconButton('edit','Edit this entry',()=>openEscrowForm(state.offering.id,state.investors,t,async()=>{await reloadOffering();drawTab();})),
        iconButton('trash','Delete this entry',async()=>{const ok=await confirmDialog('Delete this escrow entry?',{danger:true,confirmLabel:'Delete'});
          if(!ok)return;await api.deleteEscrow(t.id);toast('Deleted.','success');await reloadOffering();drawTab();},{danger:true}))}
    ],shown,{caption:'Escrow ledger',
      // The row carries what a search should look at, and where it sits, so
      // the count can be recomputed without rebuilding the table.
      rowAttrs:(t,i)=>({dataset:{search:searchText(t),idx:String(i)}})}));
    tableWrap.appendChild(el('div',{class:'empty filter-none',style:'display:none'},
      el('p',{},'Nothing in this selection matches what you typed.')));
    applySearch();
  }else updateCount(shown);
  return view;
}
async function checklistTab(state,drawTab,reloadOffering){
  const tasks=await api.listTasks(state.offering.id);
  const list=el('ul',{class:'checklist'});
  const countLabel=el('span',{class:'count-label'},`${tasks.filter(t=>t.done).length}/${tasks.length} complete`);
  function updateCount(items){countLabel.textContent=`${items.filter(x=>x.done).length}/${items.length} complete`;}
  function drawList(items){clear(list);items.forEach(t=>list.appendChild(taskRow(t,items)));}
  function taskRow(t,items){
    // Resolved at read time, exactly as the inheritance cascade resolves
    // everything else: a date the offering implies is not copied onto the
    // step, so moving the close date moves every step that followed from it.
    const implied=!t.due_date&&!t.done?impliedDue(state.offering,t):null;
    const overdue=d=>d&&daysUntil(d)<0;
    return el('li',{class:'check-item'+(t.done?' done':'')},
      el('label',{class:'check-label'},el('input',{type:'checkbox',checked:!!t.done,onchange:async e=>{
        await api.updateTask(t.id,{done:e.target.checked,done_date:e.target.checked?todayISO():null});t.done=e.target.checked?1:0;
        e.target.closest('.check-item').classList.toggle('done',!!t.done);updateCount(items);}}),el('span',{class:'check-text'},t.label)),
      el('div',{class:'check-right'},
        t.done&&t.done_date?el('span',{class:'check-due'},'Done '+fmtDate(t.done_date)):null,
        t.due_date&&!t.done?el('span',{class:'check-due'+(overdue(t.due_date)?' overdue':'')},'Due '+fmtDate(t.due_date)):null,
        implied?el('span',{class:'check-due implied'+(overdue(implied[0])?' overdue':''),
          title:`Worked out from ${implied[1]}. Type a date to override it.`},
          'Due '+fmtDate(implied[0])):null,
        el('button',{class:'icon-btn danger',title:'Delete step',onclick:async()=>{await api.deleteTask(t.id);const i=items.indexOf(t);if(i>=0)items.splice(i,1);drawList(items);updateCount(items);}},'@icon:trash')));
  }
  const newInput=el('input',{class:'inline-input',placeholder:'Add a step…',type:'text'});
  const dueInput=el('input',{class:'inline-input date',type:'date',title:'Optional due date'});
  async function addTask(){const label=newInput.value.trim();if(!label)return;
    const created=await api.createTask(state.offering.id,{label,due_date:dueInput.value||null});tasks.push(created);
    newInput.value='';dueInput.value='';drawList(tasks);updateCount(tasks);newInput.focus();}
  newInput.addEventListener('keydown',e=>{if(e.key==='Enter')addTask();});
  drawList(tasks);
  return el('section',{class:'panel'},el('div',{class:'section-head'},el('h2',{},'Process checklist'),countLabel),list,
    el('p',{class:'field-help',style:'margin:12px 0 0'},
      'A date in lighter type is one the offering already implies — the Form D window, the close dates — and it moves when the offering does. Type a date on a step to fix it instead.'),
    el('div',{class:'add-task-row'},newInput,dueInput,el('button',{class:'btn btn-primary btn-sm',onclick:addTask},'Add step')));
}
/* ---- Distributions -------------------------------------------------------
   The certificate roster already computed, per holder, the percentage of the
   company and the preferred return accrued. That is exactly what a
   distribution needs, and nothing was using it — so the accrued figure only
   ever grew, and read as a running total of what had never been settled. */
async function distributionsTab(state,drawTab,reloadOffering){
  const o=state.offering;
  const[{distributions,total,pref,capital},certData]=await Promise.all([
    api.listDistributions(o.id),api.listCertificates(o.id)]);
  const live=certData.certificates.filter(c=>!c.cancelled_date);
  const owed=certData.totalOutstanding;
  const addBtn=el('button',{class:'btn btn-primary',disabled:!live.length,
    onclick:()=>openDistributionForm(o,async()=>{await reloadOffering();drawTab();})},'@icon:plus','Record a distribution');

  return el('div',{},
    el('div',{class:'stat-row'},
      statCard('Distributed to date',money(total),{kind:'accent',sub:`${distributions.length} distribution${distributions.length===1?'':'s'}`}),
      statCard('Paid as preferred return',money(pref)),
      statCard('Paid as capital',money(capital)),
      statCard('Preferred return outstanding',money(owed),{kind:owed?'warn':undefined,sub:'across live certificates'})),
    el('div',{class:'section-head'},el('h2',{},'Distributions'),addBtn),
    el('p',{class:'field-help',style:'margin:-6px 0 16px'},
      'Money paid out to holders after a closing. Escrow is untouched by these — escrow holds subscriber funds before a closing, and a distribution comes after one. What is paid against the preferred return reduces what the certificate roster shows as still owed.'),
    !live.length?emptyState('No live certificates to distribute to. Hold a closing first.'):
    !distributions.length?emptyState('Nothing distributed yet.',
      el('button',{class:'btn btn-primary',onclick:()=>openDistributionForm(o,async()=>{await reloadOffering();drawTab();})},'Record the first distribution')):
    el('div',{},...distributions.map(d=>el('section',{class:'panel',style:'margin-bottom:16px'},
      el('div',{class:'oc-head'},
        el('div',{},el('h3',{class:'oc-name'},d.label),
          el('div',{class:'oc-issuer'},`${fmtDateLong(d.pay_date)} · ${money(d.amount_cents)}`
            +(d.method?` · ${d.method}`:'')+(d.reference?` · ${d.reference}`:''))),
        el('div',{class:'row-actions'},
          iconButton('trash',`Delete ${d.label}`,async()=>{
            const ok=await confirmDialog(`Delete “${d.label}”? What it paid against the preferred return goes back to being outstanding.`,{danger:true,confirmLabel:'Delete'});
            if(!ok)return;
            await withUndo(`deleting the distribution “${d.label}”`,()=>api.deleteDistribution(d.id),`“${d.label}” deleted.`);
            await reloadOffering();drawTab();},{danger:true}))),
      dataTable([
        {label:'Holder',primary:true,render:a=>[el('span',{},a.holder),
          el('div',{class:'cell-sub'},'Certificate ',el('span',{class:'mono'},a.cert_number||'—'))]},
        {label:'Preferred return',num:true,render:a=>a.pref_cents?money(a.pref_cents):'—'},
        {label:'Capital',num:true,render:a=>a.capital_cents?money(a.capital_cents):'—'},
        {label:'Total',num:true,render:a=>money((a.pref_cents||0)+(a.capital_cents||0))}
      ],d.allocations,{caption:`What ${d.label} paid`,
        foot:el('tr',{},el('td',{class:'rec-primary',dataset:{label:''}},'Total'),
          el('td',{class:'num',dataset:{label:'Preferred return'}},money(d.allocations.reduce((a,x)=>a+(x.pref_cents||0),0))),
          el('td',{class:'num',dataset:{label:'Capital'}},money(d.allocations.reduce((a,x)=>a+(x.capital_cents||0),0))),
          el('td',{class:'num',dataset:{label:'Total'}},money(d.amount_cents)))}),
      d.notes?el('div',{class:'notes-block'},el('p',{},d.notes)):null))));
}

function openDistributionForm(offering,onDone){
  const amountInput=el('input',{type:'text',class:'inline-input money-input',placeholder:'0.00',inputmode:'decimal'});
  const dateInput=el('input',{type:'date',class:'inline-input date',value:defaultDate()||todayISO()});
  const labelInput=el('input',{type:'text',class:'inline-input grow',
    placeholder:`Distribution ${db.distributions.filter(d=>d.offering_id===offering.id).length+1}`});
  const basisSelect=el('select',{class:'inline-input'},
    ...DISTRIBUTION_BASES.map(b=>el('option',{value:b.value},b.label)));
  const methodInput=el('input',{type:'text',class:'inline-input',placeholder:'Wire, check…'});
  const refInput=el('input',{type:'text',class:'inline-input',placeholder:'Reference'});
  const notesInput=el('input',{type:'text',class:'inline-input grow',placeholder:'Notes (optional)'});
  const basisHelp=el('p',{class:'field-help',style:'margin:6px 0 0'});
  const tableWrap=el('div',{});
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  // The proposal is a starting point, not an answer: every cell is editable,
  // and nothing is written until the parts come to the whole.
  let rows=[];
  function recompute({keepEdits=false}={}){
    const amount=Math.abs(dollarsToCents(amountInput.value)||0);
    const basis=basisSelect.value;
    basisHelp.textContent=(DISTRIBUTION_BASES.find(b=>b.value===basis)||{}).help||'';
    if(!keepEdits){
      const p=proposeDistribution(offering.id,amount,basis,dateInput.value||todayISO());
      rows=p.rows;
    }
    draw(amount);
  }
  // The table is rebuilt when the amount or the basis changes, and only then.
  // Editing a cell updates that row's total and the banner in place — a table
  // that redraws under the cursor loses focus on the way to the next field.
  const totalCells=new Map();
  const bannerWrap=el('div',{});
  function updateTotals(amount){
    for(const[r,node]of totalCells)node.textContent=money(r.pref_cents+r.capital_cents);
    const allocated=rows.reduce((a,r)=>a+r.pref_cents+r.capital_cents,0);
    const diff=amount-allocated;
    clear(bannerWrap);
    bannerWrap.appendChild(el('div',{class:'banner'+(diff?' banner-warn':'')},
      el('div',{},
        el('strong',{},money(allocated)),' allocated of ',el('strong',{},money(amount)),
        diff?el('span',{},` — ${money(Math.abs(diff))} ${diff>0?'still to allocate':'over-allocated'}`)
          :el('span',{},' — these agree.')),
      diff&&amount?el('button',{class:'btn btn-sm',type:'button',onclick:()=>recompute()},'Recalculate'):null));
  }
  function draw(amount){
    clear(tableWrap);totalCells.clear();
    if(!rows.length){tableWrap.appendChild(emptyState('No live certificates on this offering.'));return;}
    const cell=(r,key)=>el('input',{type:'text',class:'inline-input money-input',inputmode:'decimal',
      value:centsToInput(r[key]),'aria-label':`${key==='pref_cents'?'Preferred return':'Capital'} for ${r.holder}`,
      // Both, so a typed figure counts as it is typed and a pasted one counts
      // when the field is left.
      oninput:e=>{r[key]=Math.max(0,dollarsToCents(e.target.value)||0);updateTotals(amount);},
      onchange:e=>{r[key]=Math.max(0,dollarsToCents(e.target.value)||0);updateTotals(amount);}});
    tableWrap.appendChild(dataTable([
      {label:'Holder',primary:true,render:r=>[el('span',{},r.holder),
        el('div',{class:'cell-sub'},`Certificate ${r.cert_number} · ${fmtPct(r.ownership)} · ${money(r.owed)} owed`)]},
      {label:'Preferred return',num:true,render:r=>cell(r,'pref_cents')},
      {label:'Capital',num:true,render:r=>cell(r,'capital_cents')},
      {label:'Total',num:true,render:r=>{const n=el('span',{},money(r.pref_cents+r.capital_cents));
        totalCells.set(r,n);return n;}}
    ],rows,{caption:'What each holder receives'}));
    tableWrap.appendChild(bannerWrap);
    updateTotals(amount);
  }
  amountInput.addEventListener('input',()=>recompute());
  basisSelect.addEventListener('change',()=>recompute());
  dateInput.addEventListener('change',()=>recompute());
  recompute();

  const submit=el('button',{class:'btn btn-primary',type:'submit'},'Record distribution');
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    submit.disabled=true;
    try{
      await api.createDistribution(offering.id,{
        label:labelInput.value||null,pay_date:dateInput.value||null,amount:amountInput.value,
        basis:basisSelect.value,method:methodInput.value||null,reference:refInput.value||null,
        notes:notesInput.value||null,
        allocations:rows.map(r=>({certificate_id:r.certificate_id,investor_id:r.investor_id,
          pref_cents:r.pref_cents,capital_cents:r.capital_cents}))});
      closeModal();toast('Distribution recorded.','success');onDone?.();
    }catch(err){errorBox.textContent=err.message;errorBox.style.display='';submit.disabled=false;}
  }},
    errorBox,
    el('div',{class:'form-row'},el('label',{},'Amount distributed'),
      el('div',{class:'money-wrap'},el('span',{class:'money-prefix'},'$'),amountInput)),
    el('div',{class:'form-row half'},el('label',{},'Pay date'),dateInput),
    el('div',{class:'form-row half'},el('label',{},'Label'),labelInput),
    el('div',{class:'form-row'},el('label',{},'Split'),basisSelect,basisHelp),
    el('div',{class:'form-row half'},el('label',{},'Method'),methodInput),
    el('div',{class:'form-row half'},el('label',{},'Reference'),refInput),
    el('div',{class:'form-row'},tableWrap),
    el('div',{class:'form-row'},el('label',{},'Notes'),notesInput),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
      submit));
  openShell('Record a distribution',form,{wide:true});
  setTimeout(()=>amountInput.focus(),40);
}

/* ---- Transfers and redemptions ------------------------------------------- */
function transfersPanel(offering,transfers,certificates,onDone){
  const live=certificates.filter(c=>!c.cancelled_date);
  const addBtn=el('button',{class:'btn btn-ghost btn-sm',disabled:!live.length,
    onclick:()=>openTransferForm(offering,live,onDone)},'@icon:swap','Record a transfer');
  return el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Transfers and redemptions'),
        el('div',{class:'section-figures'},el('span',{},'The chain of title. A certificate is cancelled and a successor issued; neither is rewritten.'))),
      addBtn),
    !transfers.length?emptyState('Nothing has changed hands.'):
    dataTable([
      {label:'Date',primary:true,render:t=>[el('span',{},fmtDate(t.transfer_date)),
        el('div',{class:'cell-sub'},t.kind==='redemption'?'Redemption':(t.whole?'Whole holding':'Part of the holding'))]},
      {label:'From',render:t=>[el('span',{},t.from_holder||'—'),
        el('div',{class:'cell-sub'},'Certificate ',el('span',{class:'mono'},t.from_number||'—'))]},
      {label:'To',render:t=>t.kind==='redemption'?pill('Redeemed','muted')
        :[el('span',{},t.to_holder||'—'),
          el('div',{class:'cell-sub'},'Certificate ',el('span',{class:'mono'},t.to_number||'—'))]},
      {label:'Capital',num:true,render:t=>money(t.capital_cents)},
      {label:'Consideration',num:true,hide:true,render:t=>t.consideration_cents!=null?money(t.consideration_cents):'—'},
      {label:'',cls:'row-actions',render:t=>rowActions(
        iconButton('trash','Undo this transfer',async()=>{
          const ok=await confirmDialog(
            t.kind==='redemption'
              ?`Undo this redemption? Certificate ${t.from_number} goes back to being live.`
              :`Undo this transfer? Certificate ${t.to_number} is removed and ${t.from_number} goes back to being live.`,
            {danger:true,confirmLabel:'Undo it'});
          if(!ok)return;
          await withUndo('undoing a transfer',()=>api.deleteTransfer(t.id),'Transfer undone.');
          onDone?.();},{danger:true}))}
    ],transfers,{caption:'Transfers and redemptions'}));
}
function openTransferForm(offering,liveCerts,onDone){
  const investors=db.investors.slice().sort((a,b)=>investorSortKey(a).localeCompare(investorSortKey(b)));
  formModal({title:'Transfer or redemption',wide:true,submitLabel:'Record it',
    values:{kind:'transfer',whole:true,transfer_date:defaultDate()||todayISO()},
    fields:[
      {name:'kind',label:'What is happening',type:'select',half:true,
        options:TRANSFER_KINDS.map(k=>({value:k.value,label:k.label})),
        help:'A transfer issues a successor certificate. A redemption does not — the holding leaves the cap table.'},
      {name:'transfer_date',label:'Date',type:'date',half:true,
        help:'The roster as at an earlier date still shows the old holder.'},
      {name:'from_certificate_id',label:'Certificate',type:'select',required:true,
        options:[{value:'',label:'— Pick the certificate —'},
          ...liveCerts.map(c=>({value:c.id,
            label:`${c.cert_number} — ${c.holder_name||'—'} · ${c.class_name||''} · ${money(c.capital_cents)}`}))]},
      {name:'whole',label:'The whole holding',type:'checkbox',
        help:'Clear this to move part of it. What is left stays on the original certificate.'},
      {name:'capital',label:'Capital moving',type:'money',half:true,showIf:v=>!v.whole},
      {name:'to_investor_id',label:'To',type:'custom',showIf:v=>v.kind!=='redemption',
        build:val=>investorPicker(investors,val,{allowCreate:true}),
        help:'Start typing. A name that matches nothing offers to create the contact.'},
      {name:'to_holder_name',label:'Or a holder not in the contact book',half:true,
        showIf:v=>v.kind!=='redemption'&&!v.to_investor_id},
      {name:'consideration',label:'Consideration',type:'money',half:true,
        help:'What was paid for it, where that is part of the record.'},
      {name:'notes',label:'Notes',type:'textarea',rows:2}],
    onSubmit:async v=>{await api.createTransfer(offering.id,v);
      toast(v.kind==='redemption'?'Redemption recorded.':'Transfer recorded — a successor certificate has been issued.','success');
      onDone?.();}});
}

/* ---- Capital calls -------------------------------------------------------- */
function capitalCallsPanel(offering,data,onDone){
  const{calls,committed}=data;
  const calledTotal=calls.reduce((a,c)=>a+c.called,0);
  const addBtn=el('button',{class:'btn btn-ghost btn-sm',
    onclick:()=>openCapitalCallForm(offering,onDone)},'@icon:plus','Issue a call');
  return el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'Capital calls'),
        el('div',{class:'section-figures'},
          el('span',{},el('strong',{},money(calledTotal)),' called'),
          el('span',{},el('strong',{},money(committed)),' committed'),
          el('span',{},el('strong',{},money(Math.max(0,committed-calledTotal))),' uncalled'))),
      addBtn),
    !calls.length?emptyState('Nothing called yet. Subscribers owe nothing until a call is issued.'):
    dataTable([
      {label:'Call',primary:true,render:c=>[el('span',{},c.label),
        el('div',{class:'cell-sub'},`Called ${fmtDate(c.call_date)}`+(c.due_date?` · due ${fmtDate(c.due_date)}`:''))]},
      {label:'Of commitment',num:true,render:c=>c.percent!=null?fmtRate(c.percent):'—'},
      {label:'Subscribers',num:true,hide:true,render:c=>String(c.allocations.length)},
      {label:'Called',num:true,render:c=>money(c.called)},
      {label:'',cls:'row-actions',render:c=>rowActions(
        iconButton('trash',`Delete ${c.label}`,async()=>{
          const ok=await confirmDialog(`Delete “${c.label}”? What it called stops being owed.`,{danger:true,confirmLabel:'Delete'});
          if(!ok)return;
          await withUndo(`deleting the capital call “${c.label}”`,()=>api.deleteCapitalCall(c.id),`“${c.label}” deleted.`);
          onDone?.();},{danger:true}))}
    ],calls,{caption:'Capital calls'}));
}
function openCapitalCallForm(offering,onDone){
  const pctInput=el('input',{type:'number',step:'any',class:'inline-input',placeholder:'e.g. 25'});
  const labelInput=el('input',{type:'text',class:'inline-input grow',
    placeholder:`Call ${db.capital_calls.filter(c=>c.offering_id===offering.id).length+1}`});
  const callDate=el('input',{type:'date',class:'inline-input date',value:defaultDate()||todayISO()});
  const dueDate=el('input',{type:'date',class:'inline-input date'});
  const notesInput=el('input',{type:'text',class:'inline-input grow',placeholder:'Notes (optional)'});
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  const tableWrap=el('div',{});
  let rows=proposeCall(offering.id,0);
  const totalCell=el('td',{class:'num',dataset:{label:'This call'}},money(0));
  function updateCallTotal(){totalCell.textContent=money(rows.reduce((a,r)=>a+r.amount_cents,0));}
  function recompute(){
    rows=proposeCall(offering.id,pctInput.value);
    clear(tableWrap);
    if(!rows.length){tableWrap.appendChild(emptyState('No live subscribers on this offering.'));return;}
    tableWrap.appendChild(dataTable([
      {label:'Subscriber',primary:true,render:r=>[el('span',{},r.holder),
        el('div',{class:'cell-sub'},`${money(r.commitment)} committed · ${money(r.already)} already called`)]},
      {label:'This call',num:true,render:r=>el('input',{type:'text',class:'inline-input money-input',inputmode:'decimal',
        value:centsToInput(r.amount_cents),'aria-label':`Amount called from ${r.holder}`,
        // Updated in place rather than by redrawing: a table that rebuilds
        // under the cursor loses focus on the way to the next subscriber.
        oninput:e=>{r.amount_cents=Math.max(0,dollarsToCents(e.target.value)||0);updateCallTotal();},
        onchange:e=>{r.amount_cents=Math.max(0,dollarsToCents(e.target.value)||0);updateCallTotal();}})},
      {label:'Uncalled after',num:true,hide:true,render:r=>money(Math.max(0,r.commitment-r.already-r.amount_cents))}
    ],rows,{caption:'What this call asks of each subscriber',
      foot:el('tr',{},el('td',{class:'rec-primary',dataset:{label:''}},'Total called'),
        totalCell,
        el('td',{class:'rec-hide'},''))}));
    updateCallTotal();
  }
  pctInput.addEventListener('input',()=>recompute());
  recompute();
  const submit=el('button',{class:'btn btn-primary',type:'submit'},'Issue call');
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';submit.disabled=true;
    try{
      await api.createCapitalCall(offering.id,{label:labelInput.value||null,
        call_date:callDate.value||null,due_date:dueDate.value||null,percent:pctInput.value||null,
        notes:notesInput.value||null,
        allocations:rows.map(r=>({subscription_id:r.subscription_id,investor_id:r.investor_id,amount_cents:r.amount_cents}))});
      closeModal();toast('Capital call issued.','success');onDone?.();
    }catch(err){errorBox.textContent=err.message;errorBox.style.display='';submit.disabled=false;}
  }},
    errorBox,
    el('p',{class:'field-help'},'Enter a percentage of each commitment and adjust any line that differs. Nobody is ever called for more than they committed.'),
    el('div',{class:'form-row half'},el('label',{},'Percentage of commitment'),pctInput),
    el('div',{class:'form-row half'},el('label',{},'Label'),labelInput),
    el('div',{class:'form-row half'},el('label',{},'Call date'),callDate),
    el('div',{class:'form-row half'},el('label',{},'Payment due'),dueDate),
    el('div',{class:'form-row'},tableWrap),
    el('div',{class:'form-row'},el('label',{},'Notes'),notesInput),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
      submit));
  openShell('Issue a capital call',form,{wide:true});
  setTimeout(()=>pctInput.focus(),40);
}

/* ---- Breaking escrow ------------------------------------------------------
   The offering that did not reach its minimum by its deadline. Everything
   needed is already on file; what was missing was any way to act on it that
   was not forty manual ledger entries at the worst possible moment. */
async function openBreakEscrow(offering,onDone){
  const plan=api.proposeBreak(offering.id);
  if(plan.closingsHeld){
    toast('This offering has already held a closing, so funds have left escrow. Undo the closing first if it should not stand.','error');
    return;
  }
  const dateInput=el('input',{type:'date',class:'inline-input date',value:defaultDate()||todayISO()});
  const refInput=el('input',{type:'text',class:'inline-input grow',placeholder:'Reference for the refunds (optional)'});
  const ack=el('input',{type:'checkbox'});
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  const submit=el('button',{class:'btn btn-danger',type:'submit'},'Break escrow');
  const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    if(!ack.checked){errorBox.textContent='Confirm that this offering is being terminated.';errorBox.style.display='';return;}
    submit.disabled=true;
    try{
      await withUndo(`breaking escrow on “${offering.name}”`,
        ()=>api.breakOffering(offering.id,{refund_date:dateInput.value||null,reference:refInput.value||null}),
        `Escrow broken — ${plan.refunds.length} refund${plan.refunds.length===1?'':'s'} recorded and the offering terminated.`);
      closeModal();onDone?.();
    }catch(err){errorBox.textContent=err.message;errorBox.style.display='';submit.disabled=false;}
  }},
    errorBox,
    el('div',{class:`readiness-banner ${plan.minRaiseMet?'met':'short'}`},
      el('div',{},
        el('strong',{},plan.minRaiseMet
          ?'The minimum raise has been met on this offering.'
          :`${money(plan.cleared)} cleared against a ${money(plan.minRaise)} minimum.`),
        el('div',{class:'readiness-detail'},plan.minRaiseMet
          ?'Breaking escrow anyway will refund every subscriber and terminate the offering. That is rarely what is wanted here.'
          :(plan.deadline
            ?`The deadline was ${fmtDateLong(plan.deadline)}${plan.daysPastDeadline>0?`, ${plan.daysPastDeadline} days ago`:''}.`
            :'This offering has no final close deadline recorded.')))),
    el('p',{class:'field-help'},'This records a refund of everything each subscriber has cleared, withdraws every subscription, and terminates the offering. Nothing is written until you press the button, and it can be taken back straight afterwards.'),
    plan.refunds.length?dataTable([
      {label:'Subscriber',primary:true,render:r=>r.holder},
      {label:'Refunded',num:true,render:r=>money(r.amount_cents)}
    ],plan.refunds,{caption:'Refunds this will record',
      foot:el('tr',{},el('td',{class:'rec-primary',dataset:{label:''}},`${plan.refunds.length} refund${plan.refunds.length===1?'':'s'}`),
        el('td',{class:'num',dataset:{label:'Refunded'}},money(plan.totalRefund)))})
      :el('p',{class:'muted-text'},'Nothing has cleared escrow, so there is nothing to refund. This will withdraw the subscriptions and terminate the offering.'),
    el('div',{class:'form-row half'},el('label',{},'Refund date'),dateInput),
    el('div',{class:'form-row half'},el('label',{},'Reference'),refInput),
    el('label',{class:'ack-row'},ack,
      el('span',{},`Terminate ${offering.name} and withdraw all ${plan.subscriptions} subscription${plan.subscriptions===1?'':'s'}.`)),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),
      submit));
  openShell('Break escrow and terminate the offering',form,{wide:true});
}

/* ---- Filings -------------------------------------------------------------
   What has to be filed, when it was due, and what has actually gone in. The
   checklist used to carry one line for the whole of state practice. */
async function filingsTab(state,drawTab,reloadOffering){
  const o=state.offering;
  const{formD,states,missing,unplaced}=await api.listFilings(o.id);
  const standing=purchaserStanding(o.id);

  const formDPanel=(()=>{
    if(!formD)return el('section',{class:'panel'},
      el('h2',{class:'panel-title'},'Form D'),
      el('p',{class:'muted-text'},o.exemption
        ?`This offering is recorded under ${o.exemption}, which does not call for a Form D.`
        :'Set an exemption on this offering and its filing position appears here.'));
    const rows=[
      ['Exemption',o.exemption],
      ['First sale',formD.firstSale?`${fmtDate(formD.firstSale)} — from ${formD.from}`:'Nothing sold yet'],
      ['Due',formD.due?fmtDate(formD.due):'Fifteen days after the first sale'],
      ['Filed',formD.filed?fmtDate(formD.filed):null],
      formD.amendmentDue?['Next amendment',fmtDate(formD.amendmentDue)]:null];
    const verdict=
      !formD.firstSale?pill('Nothing sold yet — no clock running','muted')
      :formD.filed&&formD.filedLate?pill(`Filed ${fmtDate(formD.filed)}, after the ${fmtDate(formD.due)} deadline`,'warn')
      :formD.filed?pill(`Filed ${fmtDate(formD.filed)}`,'success')
      :formD.overdue?pill(`Overdue — due ${fmtDate(formD.due)}, ${relDays(formD.daysLeft)}`,'danger')
      :pill(`Due ${fmtDate(formD.due)} — ${relDays(formD.daysLeft)}`,formD.daysLeft<=5?'warn':'info');
    return el('section',{class:'panel'},
      el('div',{class:'section-head',style:'margin-top:0'},el('h2',{},'Form D'),
        el('button',{class:'btn btn-ghost btn-sm',onclick:()=>openOfferingForm(o,()=>{reloadOffering().then(drawTab);})},
          formD.filed?'Edit the filing date':'Record the filing')),
      el('div',{style:'margin:0 0 12px'},verdict),
      detailGrid(rows.filter(Boolean)),
      el('p',{class:'field-help',style:'margin:12px 0 0'},
        'Rule 503 gives fifteen calendar days from the date of first sale. Muniment works that date out from the earliest signed subscription or the earliest cleared deposit, whichever came first, and does not file anything for you.'));
  })();

  const diligencePanel=el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},el('h2',{},'Exemption diligence'),
      el('button',{class:'btn btn-ghost btn-sm',onclick:()=>openOfferingForm(o,()=>{reloadOffering().then(drawTab);})},'Edit')),
    detailGrid([
      ['Bad-actor inquiry (Rule 506(d))',o.bad_actor_checked_date
        ?el('span',{},pill('Recorded','success'),' ',fmtDate(o.bad_actor_checked_date))
        :pill('Not recorded','warn')],
      ['General solicitation',o.general_solicitation?'Yes — permitted under 506(c) only':'No'],
      ['Purchasers',`${standing.total} on the roster`],
      ['Verified',String(standing.verified.length)],
      standing.selfCertified.length?['Self-certified',String(standing.selfCertified.length)]:null,
      standing.nonAccredited.length?['Not accredited',`${standing.nonAccredited.length}`+(o.exemption==='Reg D 506(b)'?` of ${RULE_506B_LIMIT} allowed`:'')]:null,
      standing.unestablished.length?['Status not established',String(standing.unestablished.length)]:null
    ].filter(Boolean)),
    o.bad_actor_notes?el('div',{class:'notes-block'},el('h3',{},'Inquiry notes'),el('p',{},o.bad_actor_notes)):null);

  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openStateFilingForm(o,null,null,async()=>{await reloadOffering();drawTab();})},'@icon:plus','Add a state');
  const openRows=states.filter(f=>!f.filed_date).length;
  const totalFees=states.reduce((a,f)=>a+(f.fee_cents||0),0);

  const bluePanel=el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin-top:0'},
      el('div',{},el('h2',{},'State notice filings'),
        el('div',{class:'section-figures'},
          el('span',{},el('strong',{},String(states.length)),' state',states.length===1?'':'s'),
          openRows?el('span',{},el('strong',{},String(openRows)),' not yet filed'):null,
          totalFees?el('span',{},el('strong',{},money(totalFees)),' in fees'):null)),
      addBtn),
    el('p',{class:'field-help',style:'margin:-4px 0 14px'},
      'One filing per state a subscriber is resident in. Most states want a notice within fifteen days of the first sale in the state, with a fee. Muniment works out which states are in play from the roster; the dates and confirmations are yours to enter.'),
    missing.length?el('div',{class:'banner banner-warn'},
      el('div',{},el('strong',{},`${missing.length} state${missing.length===1?'':'s'} on the roster with no row here: `),
        missing.map(m=>stateName(m.state)).join(', ')),
      el('button',{class:'btn btn-sm',onclick:async()=>{
        for(const m of missing)await api.saveStateFiling(o.id,{state:m.state});
        toast(`Added ${missing.length} state${missing.length===1?'':'s'}.`,'success');
        await reloadOffering();drawTab();}},'Add them')):null,
    !states.length?emptyState('No state filings recorded yet.'):
    dataTable([
      {label:'State',primary:true,render:f=>[el('span',{},stateName(f.state)),
        el('div',{class:'cell-sub'},f.holders.length?f.holders.slice(0,2).join(', ')+(f.holders.length>2?` and ${f.holders.length-2} more`:''):'No current subscriber resident here')]},
      {label:'Code',hide:true,cls:'mono',render:f=>f.state},
      {label:'Filed',render:f=>f.filed_date?el('span',{},pill(fmtDate(f.filed_date),'success')):pill('Not filed','warn')},
      {label:'Fee',num:true,render:f=>f.fee_cents!=null?money(f.fee_cents):'—'},
      {label:'Confirmation',hide:true,cls:'mono',render:f=>f.confirmation||'—'},
      {label:'',cls:'row-actions',render:f=>rowActions(
        iconButton('edit',`Edit the ${stateName(f.state)} filing`,()=>openStateFilingForm(o,f,null,async()=>{await reloadOffering();drawTab();})),
        iconButton('trash',`Delete the ${stateName(f.state)} filing`,async()=>{
          const ok=await confirmDialog(`Delete the ${stateName(f.state)} filing row?`,{danger:true,confirmLabel:'Delete'});
          if(!ok)return;await api.deleteStateFiling(f.id);toast('Deleted.','success');
          await reloadOffering();drawTab();},{danger:true}))}
    ],states,{caption:'State notice filings',
      foot:totalFees?el('tr',{},el('td',{class:'rec-primary',dataset:{label:''}},'Total fees'),
        el('td',{class:'rec-hide'},''),el('td',{class:'rec-hide'},''),
        el('td',{class:'num',dataset:{label:'Fee'}},money(totalFees)),
        el('td',{class:'rec-hide'},''),el('td',{class:'rec-hide'},'')):null}),
    unplaced.length?el('p',{class:'field-help',style:'margin:12px 0 0'},
      `${unplaced.length} subscriber${unplaced.length===1?' has':'s have'} no state recorded (${unplaced.slice(0,3).join(', ')}${unplaced.length>3?` and ${unplaced.length-3} more`:''}), so any filing they call for is not shown here.`):null);

  return el('div',{},el('div',{class:'grid-2'},formDPanel,diligencePanel),bluePanel);
}
function openStateFilingForm(offering,existing,presetState,onDone){
  formModal({title:existing?`Edit the ${stateName(existing.state)} filing`:'State notice filing',wide:true,
    submitLabel:existing?'Save changes':'Add',
    values:existing?{state:existing.state,filed_date:existing.filed_date,fee:centsToInput(existing.fee_cents),
      confirmation:existing.confirmation,notes:existing.notes}
      :{state:presetState||'',filed_date:''},
    fields:[
      {name:'state',label:'State',type:'select',required:true,half:true,
        options:[{value:'',label:'— Pick a state —'},...US_STATES.map(c=>({value:c,label:`${c} — ${stateName(c)}`}))]},
      {name:'filed_date',label:'Filed on',type:'date',half:true,help:'Leave blank until it has gone in.'},
      {name:'fee',label:'Filing fee',type:'money',half:true},
      {name:'confirmation',label:'Confirmation / file number',half:true,mono:true},
      {name:'notes',label:'Notes',type:'textarea',rows:2}],
    onSubmit:async v=>{await api.saveStateFiling(offering.id,v,existing?existing.id:null);
      toast(existing?'Filing saved.':'State added.','success');onDone?.();}});
}

async function reconciliationTab(state){
  const{reconciliations,summary}=await api.listReconciliations(state.offering.id);
  const dateInput=el('input',{type:'date',class:'inline-input date'});
  const balInput=el('input',{type:'text',class:'inline-input money-input',placeholder:'0.00',inputmode:'decimal'});
  const notesInput=el('input',{type:'text',class:'inline-input grow',placeholder:'Notes (optional)'});
  async function addRecon(){if(!balInput.value.trim()){toast('Enter the statement balance.','error');return;}
    await api.createReconciliation(state.offering.id,{statement_date:dateInput.value||null,statement_balance:balInput.value,notes:notesInput.value||null});
    toast('Reconciliation saved.','success');refresh();}
  return el('div',{},
    el('section',{class:'panel'},el('h2',{class:'panel-title'},'Reconcile to bank statement'),
      el('p',{class:'muted-text'},'The app tracks a cleared book balance of ',el('strong',{},money(summary.clearedBalance)),'. Enter your escrow bank statement balance to check they agree.'),
      el('div',{class:'recon-form'},
        el('div',{class:'recon-field'},el('label',{},'Statement date'),dateInput),
        el('div',{class:'recon-field'},el('label',{},'Statement balance'),el('div',{class:'money-wrap'},el('span',{class:'money-prefix'},'$'),balInput)),
        el('div',{class:'recon-field grow'},el('label',{},'Notes'),notesInput),
        el('button',{class:'btn btn-primary',onclick:addRecon},'Check'))),
    el('section',{class:'panel'},el('h2',{class:'panel-title'},'Reconciliation history'),
      !reconciliations.length?emptyState('No reconciliations recorded yet.'):
      dataTable([
        {label:'Statement date',primary:true,render:r=>[
          el('span',{},fmtDate(r.statement_date)),
          r.historical?null:el('div',{class:'cell-sub'},'Compared against today\u2019s balance')]},
        {label:'Statement balance',num:true,render:r=>money(r.statement_balance_cents)},
        {label:'App cleared balance',num:true,render:r=>money(r.app_cleared_cents)},
        {label:'Difference',num:true,render:r=>r.difference_cents===0
          ? pill('Matches','success')
          : pill((r.difference_cents>0?'+':'\u2212')+money(Math.abs(r.difference_cents)),'danger')},
        {label:'Notes',hide:true,render:r=>r.notes||'—'},
        {label:'',cls:'row-actions',render:r=>rowActions(
          iconButton('trash','Delete this reconciliation',async()=>{
            const ok=await confirmDialog('Delete this reconciliation?',{danger:true,confirmLabel:'Delete'});
            if(!ok)return;await api.deleteReconciliation(r.id);toast('Deleted.','success');refresh();},{danger:true}))}
      ],reconciliations,{caption:'Reconciliation history'})));
}

async function closingsTab(state,drawTab,reloadOffering){
  const[{closings,totalReleased},subs]=await Promise.all([
    api.listClosings(state.offering.id),api.listSubscriptions(state.offering.id)]);
  // Subscriptions eligible to be included in a new closing.
  const openSubs=subs.filter(s=>s.status!=='Withdrawn'&&!s.closing_id);
  const s=state.offering.summary;

  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openClosingForm(state.offering.id,openSubs,closings.length,
    async()=>{await reloadOffering();drawTab();})},'@icon:plus','Conduct a closing');
  // The other ending. Offered only where it is the live question: money is
  // held, nothing has closed, and the minimum has not been reached.
  const o=state.offering;
  const past=o.final_close_date?daysUntil(o.final_close_date)<0:false;
  const canBreak=!closings.length&&!s.minRaiseMet&&o.target_min_cents&&
    !['Terminated'].includes(o.status)&&(s.escrow.clearedBalance>0||subs.length>0);
  const breakBtn=canBreak?el('button',{class:'btn btn-danger-ghost',
    onclick:()=>openBreakEscrow(o,async()=>{await reloadOffering();drawTab();})},
    'Break escrow…'):null;

  return el('div',{},
    canBreak&&past?el('div',{class:'banner banner-warn'},
      el('div',{},el('strong',{},`${o.name} passed its final close deadline on ${fmtDate(o.final_close_date)} `),
        `with ${money(s.escrow.clearedNetDeposits)} cleared against a ${money(o.target_min_cents)} minimum. `,
        'Breaking escrow refunds every subscriber and terminates the offering.'),
      el('button',{class:'btn btn-sm btn-danger',onclick:()=>openBreakEscrow(o,async()=>{await reloadOffering();drawTab();})},
        'Break escrow…')):null,
    el('div',{class:'stat-row'},
      statCard('Closings held',String(closings.length)),
      statCard('Total released to issuer',money(totalReleased),{kind:'accent'}),
      statCard('Cleared in escrow',money(s.escrow.clearedBalance),{sub:'remaining balance'}),
      statCard('Investors not yet closed',String(openSubs.length),{sub:`${subs.length} total`})),
    el('div',{class:'section-head'},el('h2',{},'Closings'),
      el('div',{style:'display:flex;gap:8px'},breakBtn,addBtn)),
    !closings.length
      ? emptyState('No closings recorded yet.',
          openSubs.length||s.escrow.clearedBalance?el('button',{class:'btn btn-primary',onclick:()=>openClosingForm(state.offering.id,openSubs,0,async()=>{await reloadOffering();drawTab();})},'Conduct the first closing'):null)
      : el('div',{},...closings.map(c=>closingCard(c,drawTab,reloadOffering))));
}
function closingCard(c,drawTab,reloadOffering){
  const committed=c.investors.reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  return el('section',{class:'panel closing-panel'},
    el('div',{class:'section-head'},
      el('div',{},el('h3',{style:'margin:0;font-size:17px'},c.label),
        el('div',{class:'muted-text',style:'font-size:13px;margin-top:2px'},
          fmtDate(c.closing_date)+` · ${c.investor_count} investor${c.investor_count===1?'':'s'}`+(committed?` · ${money(committed)} committed`:''))),
      el('div',{style:'text-align:right'},
        el('div',{},el('strong',{style:'font-size:16px'},money(c.amount_released_cents)),el('span',{class:'muted-text'},' released')),
        c.fees_cents?el('div',{class:'muted-text',style:'font-size:12px'},money(c.fees_cents)+' fees'):null)),
    c.investors.length?el('div',{class:'closing-chips'},...c.investors.map(s=>
      el('span',{class:'chip'},s.investor_name,el('span',{class:'chip-amt'},money(s.amount_committed_cents))))):el('p',{class:'muted-text',style:'margin:6px 0 0'},'No investors linked to this closing.'),
    c.notes?el('p',{class:'muted-text',style:'margin:10px 0 0'},c.notes):null,
    el('div',{style:'margin-top:12px;text-align:right'},
      el('button',{class:'btn btn-danger-ghost btn-sm',onclick:async()=>{
        const ok=await confirmDialog(`Delete “${c.label}”? This removes its escrow release/fee entries and re-opens (un-closes) its investors. This cannot be undone.`,{danger:true,confirmLabel:'Delete closing'});
        if(!ok)return;
        await withUndo(`undoing the closing “${c.label}”`,()=>api.deleteClosing(c.id),`“${c.label}” undone.`);
        await reloadOffering();drawTab();}},'Delete closing')));
}
function openClosingForm(offeringId,openSubs,existingCount,onDone){
  const o=db.offerings.find(x=>x.id===Number(offeringId))||{};
  const es=escrowSummary(offeringId);
  // What each selected subscriber has actually put into escrow, and what is
  // available to release. A closing releases money, not promises.
  const clearedFor=sub=>Math.max(0,investorEscrow(offeringId,sub.investor_id,sub.id).clearedNet);
  const labelInput=el('input',{type:'text',class:'inline-input',style:'width:100%',value:`Closing ${existingCount+1}`});
  const dateInput=el('input',{type:'date',class:'inline-input',style:'width:100%',value:defaultDate()});
  const amountInput=el('input',{type:'text',class:'inline-input money-input',placeholder:'0.00',inputmode:'decimal',style:'width:100%'});
  const feesInput=el('input',{type:'text',class:'inline-input money-input',placeholder:'0.00',inputmode:'decimal',style:'width:100%'});
  const notesInput=el('textarea',{rows:2,class:'inline-input',style:'width:100%'});
  const markClosed=el('input',{type:'checkbox',checked:true});
  const issueCerts=el('input',{type:'checkbox',checked:true});
  let amountEdited=false,feesEdited=false;
  amountInput.addEventListener('input',()=>{amountEdited=true;});
  feesInput.addEventListener('input',()=>{feesEdited=true;});
  const checks=[];
  // Two figures, always both on screen: what was promised, and what is there.
  const tally=el('div',{class:'field-note'});
  function recompute(){
    const picked=checks.filter(c=>c.cb.checked);
    const committed=picked.reduce((a,c)=>a+(c.sub.amount_committed_cents||0),0);
    const cleared=picked.reduce((a,c)=>a+clearedFor(c.sub),0);
    // Never propose releasing more than is in the account.
    const releasable=Math.min(cleared,Math.max(0,es.clearedBalance));
    if(!amountEdited)amountInput.value=releasable?(releasable/100).toFixed(2):'';
    if(!feesEdited&&o.pass_through_costs){
      const costs=picked.reduce((a,c)=>a+(c.sub.costs_cents||0),0);
      feesInput.value=costs?(costs/100).toFixed(2):'';
    }
    clear(tally);
    if(picked.length)tally.appendChild(el('span',{},
      `${picked.length} selected · ${money(committed)} committed · `,
      el('strong',{},`${money(cleared)} cleared in escrow`),
      cleared<committed?el('span',{class:'warn-text'},` · ${money(committed-cleared)} not yet received`):null));
    else tally.appendChild(el('span',{},`${money(es.clearedBalance)} is available in escrow.`));
  }
  // Funded subscribers first — they are who a closing is for.
  const ordered=openSubs.slice().sort((a,b)=>(clearedFor(b)>0)-(clearedFor(a)>0)||String(a.investor_name||'').localeCompare(String(b.investor_name||'')));
  const rows=ordered.map(sub=>{const cb=el('input',{type:'checkbox',onchange:recompute});checks.push({cb,sub});
    const got=clearedFor(sub);
    return el('label',{class:'pick-row'+(got?'':' unfunded')},cb,el('span',{class:'pick-name'},sub.investor_name,
      sub.status?el('span',{class:'pick-status'},sub.status):null),
      el('span',{class:'pick-amt'},money(sub.amount_committed_cents),
        el('span',{class:got?'pick-funded':'pick-pending'},got?`${money(got)} in escrow`:'nothing received')));});
  const selectAll=el('input',{type:'checkbox',onchange:e=>{checks.forEach(c=>c.cb.checked=e.target.checked);recompute();}});
  const picklist=openSubs.length
    ? el('div',{},el('label',{class:'pick-row pick-all'},selectAll,el('span',{class:'pick-name'},'Select all'),el('span',{})),
        el('div',{class:'closing-picklist'},...rows),tally)
    : el('p',{class:'field-help'},'No open investors to include. You can still record a release amount.');
  // The precondition that matters most in an escrowed offering, stated before
  // the form is filled in rather than discovered afterwards.
  const met=o.target_min_cents==null||es.clearedNetDeposits>=o.target_min_cents;
  const ackBox=el('input',{type:'checkbox'});
  const readiness=o.target_min_cents==null
    ? el('div',{class:'readiness-banner'},el('span',{},'No minimum raise is set on this offering.'))
    : el('div',{class:'readiness-banner '+(met?'met':'short')},
        el('span',{},met?'@icon:check':'@icon:warning'),
        el('div',{},
          el('strong',{},met?'Minimum raise satisfied':'Minimum raise not yet satisfied'),
          el('div',{class:'readiness-detail'},`${money(es.clearedNetDeposits)} cleared against a ${money(o.target_min_cents)} minimum`+
            (met?'.':` — ${money(o.target_min_cents-es.clearedNetDeposits)} short.`))),
        met?null:el('label',{class:'ack-row'},ackBox,el('span',{},'Close anyway — I have a reason on file')));
  const errorBox=el('div',{class:'form-error',style:'display:none'});
  const submitBtn=el('button',{class:'btn btn-primary',type:'submit'},'Record closing');
  function field(label,node,help){return el('div',{class:'form-row'},el('label',{},label),node,help?el('div',{class:'field-help'},help):null);}
  const form=el('form',{class:'modal-body',onsubmit:async e=>{
    e.preventDefault();errorBox.style.display='none';
    const selectedIds=checks.filter(c=>c.cb.checked).map(c=>c.sub.id);
    if(!amountInput.value.trim()&&!feesInput.value.trim()){errorBox.textContent='Enter the amount released to the issuer.';errorBox.style.display='block';return;}
    if(!met&&!ackBox.checked){
      errorBox.textContent=`Only ${money(es.clearedNetDeposits)} has cleared escrow against a ${money(o.target_min_cents)} minimum raise. Tick the acknowledgement to close anyway.`;
      errorBox.style.display='block';return;}
    const asked=dollarsToCents(amountInput.value)||0;
    const askedFees=dollarsToCents(feesInput.value)||0;
    // Fees leave escrow with the release; both together must fit.
    if(asked+askedFees>es.clearedBalance){
      errorBox.textContent=`Only ${money(es.clearedBalance)} has cleared escrow, so ${money(asked)}${askedFees?` plus ${money(askedFees)} in fees`:''} cannot come out of it.`;
      errorBox.style.display='block';return;}
    submitBtn.disabled=true;submitBtn.textContent='Saving…';
    try{
      const res=await api.createClosing(offeringId,{label:labelInput.value,closing_date:dateInput.value||null,
        amount_released:amountInput.value,fees:feesInput.value,investor_sub_ids:selectedIds,
        mark_closed:markClosed.checked,issue_certs:issueCerts.checked,notes:notesInput.value||null});
      const n=res&&res.certsIssued||0;
      toast(n?`Closing recorded — ${n} certificate${n===1?'':'s'} issued.`:'Closing recorded.','success');closeModal();onDone?.();
    }catch(err){errorBox.textContent=err.message;errorBox.style.display='block';submitBtn.disabled=false;submitBtn.textContent='Record closing';}
  }},
    readiness,
    field('Label',labelInput),
    el('div',{class:'form-grid',style:'gap:14px 16px'},
      el('div',{class:'form-row half'},el('label',{},'Closing date'),dateInput),
      el('div',{class:'form-row half'},el('label',{},'Amount released to issuer'),el('div',{class:'money-wrap'},el('span',{class:'money-prefix'},'$'),amountInput)),
      el('div',{class:'form-row half'},el('label',{},'Fees / costs deducted'),el('div',{class:'money-wrap'},el('span',{class:'money-prefix'},'$'),feesInput))),
    field('Investors included in this closing',picklist,'Selected investors are marked Closed and linked to this closing. The release and any fees are recorded in the escrow ledger.'),
    el('label',{class:'pick-row',style:'padding-left:0'},markClosed,el('span',{},'Mark selected investors as “Closed”')),
    el('label',{class:'pick-row',style:'padding-left:0'},issueCerts,el('span',{},'Issue certificates for the included investors'),
      el('span',{class:'field-help'},'Numbered by funding date; capital, % interest and accrued return auto-populate.')),
    field('Notes',notesInput),
    errorBox,
    el('div',{class:'modal-actions'},el('button',{class:'btn btn-ghost',type:'button',onclick:closeModal},'Cancel'),submitBtn));
  openShell('Conduct a closing',form,{wide:true});
  recompute();
  setTimeout(()=>labelInput.focus(),50);
}

async function certificatesTab(state,drawTab,reloadOffering){
  const offering=state.offering;
  const refreshTab=async()=>{if(reloadOffering)await reloadOffering();(drawTab||refresh)();};
  // The date the roster speaks as at. Held on the tab state so it survives a
  // redraw, because "as at 30 June" is a question you ask more than once.
  if(!state.certAsOf)state.certAsOf=todayISO();
  const asOf=state.certAsOf;
  const[data,investors,transfers]=await Promise.all([
    api.listCertificates(offering.id,asOf),api.listInvestors(),api.listTransfers(offering.id)]);
  const{certificates,classNames,classes,totalCapital,totalAccrued,totalOutstanding,totalPercent}=data;
  const allClassNames=[...new Set([...(classes||[]).map(c=>c.name),...classNames])];
  const today=todayISO();
  const asOfInput=el('input',{type:'date',class:'inline-input date',value:asOf,max:'2999-12-31',
    'aria-label':'Show the roster as at this date',
    onchange:e=>{state.certAsOf=e.target.value||today;state.redrawTab();}});
  const asOfRow=el('div',{class:'asof-row'},
    el('label',{class:'asof-label'},'As at'),asOfInput,
    asOf!==today?el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{state.certAsOf=today;state.redrawTab();}},'Back to today'):null,
    el('span',{class:'field-help',style:'margin:0'},
      asOf===today?'Accrual is shown to today.':`Accrual, holdings and distributions are shown as they stood on ${fmtDate(asOf)}.`));
  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openCertificateForm(offering,investors,allClassNames,null,()=>refresh())},'@icon:plus','Add certificate');
  const renumBtn=certificates.length?el('button',{class:'btn btn-ghost btn-sm',title:'Re-assign all certificate numbers 1..N by funding date',
    onclick:async()=>{const ok=await confirmDialog('Re-number every certificate 1…N in funding-date order? Any manual numbers will be replaced.',{confirmLabel:'Renumber'});
      if(!ok)return;await api.renumberCertificates(offering.id);toast('Certificates renumbered by funding date.','success');refresh();}},'@icon:swap','Renumber by funding date'):null;
  const groups=new Map();
  for(const c of certificates){const k=c.class_name||'Unclassified';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
  return el('div',{},
    el('div',{class:'stat-row'},
      statCard('Certificates',String(certificates.length)),
      statCard('Total capital contributed',money(totalCapital),{kind:'accent'}),
      statCard('Total % ownership',fmtPct(totalPercent),{sub:groups.size>1?`${groups.size} classes`:'issued'}),
      totalOutstanding!==totalAccrued
        ?statCard('Preferred return outstanding',money(totalOutstanding),{sub:`${money(totalAccrued)} accrued, less distributions`})
        :statCard('Accrued return',money(totalAccrued),{sub:asOf===today?'to today':`to ${fmtDate(asOf)}`})),
    asOfRow,
    classStructurePanel(offering,classNames),
    el('div',{class:'section-head'},el('h2',{},'Certificate roster'),
      el('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},
        certificates.length?el('button',{class:'btn btn-ghost btn-sm',onclick:()=>exportCapTable(offering,data)},'@icon:download','CSV'):null,
        renumBtn,addBtn)),
    !certificates.length
      ? emptyState('No certificates issued yet. They are created automatically when you conduct a closing, or add one manually.',el('button',{class:'btn btn-primary',onclick:()=>openCertificateForm(offering,investors,allClassNames,null,()=>refresh())},'Add a certificate'))
      : el('div',{},...[...groups.entries()].map(([cls,certs])=>certClassPanel(cls,certs,offering,investors,allClassNames))),
    // The chain of title sits under the roster it explains.
    (certificates.length||transfers.length)?transfersPanel(offering,transfers,certificates,refreshTab):null);
}
// Optional editor for fixed class ownership splits (e.g. Common 20% / Class A 80%).
function classStructurePanel(offering,classNames){
  const classes=Array.isArray(offering.classes)?offering.classes.map(c=>({...c})):[];
  const open=classes.length>0;
  const body=el('div',{style:open?'':'display:none'});
  const rowsWrap=el('div',{class:'class-rows'});
  function draw(){clear(rowsWrap);
    classes.forEach((c,idx)=>{
      const name=el('input',{class:'inline-input',value:c.name||'',placeholder:'Class name',oninput:e=>c.name=e.target.value});
      const pct=el('input',{class:'inline-input',type:'number',step:'any',style:'width:110px',value:c.total_percent??'',placeholder:'% of co.',oninput:e=>c.total_percent=e.target.value===''?null:Number(e.target.value)});
      const sponsor=el('input',{type:'checkbox',checked:!!c.sponsor,onchange:e=>c.sponsor=e.target.checked});
      rowsWrap.appendChild(el('div',{class:'class-row'},
        name,el('span',{class:'money-prefix',style:'padding:0'},''),pct,el('span',{class:'field-help'},'%'),
        el('label',{class:'form-check',style:'font-size:13px'},sponsor,el('span',{},'Sponsor / non-cash')),
        el('button',{class:'icon-btn danger',title:'Remove',onclick:()=>{classes.splice(idx,1);draw();}},'@icon:trash')));});
    const sum=classes.reduce((a,c)=>a+(Number(c.total_percent)||0),0);
    rowsWrap.appendChild(el('div',{class:'field-help',style:'margin-top:6px'},
      classes.length?`Defined classes total ${fmtRate(sum)} of the company.`:'No classes defined — % interest is pro-rated across all capital.'));
  }
  draw();
  const addRow=el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{classes.push({name:'',total_percent:null,sponsor:false});draw();}},'@icon:plus','Add class');
  const saveBtn=el('button',{class:'btn btn-primary btn-sm',onclick:async()=>{
    await api.saveClasses(offering.id,classes);toast('Class structure saved.','success');refresh();}},'Save class structure');
  const toggle=el('button',{class:'btn btn-ghost btn-sm',onclick:()=>{body.style.display=body.style.display==='none'?'':'none';}},
    open?'Class structure':'Set up class ownership split…');
  return el('section',{class:'panel'},
    el('div',{class:'section-head',style:'margin:0'},el('h2',{style:'font-size:15px'},'Ownership classes (optional)'),toggle),
    body,
    (()=>{body.appendChild(el('p',{class:'field-help',style:'margin:4px 0 12px'},
      'Define classes that each represent a fixed share of the whole company — e.g. Common Units = 20% (held by the sponsor for putting on the offering), Class A Units = 80% (sold to investors). Mark a class “sponsor / non-cash” when it is taken for holding the offering rather than for cash. Leave this empty to pro-rate % interest across all capital.'));
      body.appendChild(rowsWrap);body.appendChild(el('div',{style:'display:flex;gap:8px;margin-top:12px'},addRow,saveBtn));return null;})());
}
function certClassPanel(cls,certs,offering,investors,classNames){
  const cap=certs.reduce((a,c)=>a+(c.capital_cents||0),0);
  // Summed from the settled figures, so the total agrees with the column
  // above it rather than with an exact arithmetic nobody can see.
  const totPct=certs.reduce((a,c)=>a+(Number(c.total_pct_shown)||0),0);
  const clsPct=certs.reduce((a,c)=>a+(Number(c.pct_of_class_shown)||0),0);
  const accr=certs.reduce((a,c)=>a+(c.accrued_calc||0),0);
  const outstanding=certs.reduce((a,c)=>a+(c.accrued_outstanding||0),0);
  const paidPref=certs.reduce((a,c)=>a+(c.pref_paid_cents||0),0);
  // The paid column only earns its width once something has been paid.
  const anyPaid=paidPref>0;
  const classTotal=certs[0]&&certs[0].class_total_percent!=null?certs[0].class_total_percent:null;
  const sponsor=certs[0]&&certs[0].class_sponsor;
  return el('section',{class:'panel'},
    el('h3',{style:'margin:0 0 12px;font-size:16px'},cls,
      sponsor?el('span',{class:'pill pill-info',style:'margin-left:8px;vertical-align:middle'},'Sponsor / non-cash'):null,
      el('span',{class:'muted-text',style:'font-weight:400;font-size:13px'},
        `  ·  ${certs.length} certificate${certs.length===1?'':'s'} · ${money(cap)}`+(classTotal!=null?` · class = ${fmtRate(classTotal)} of company`:''))),
    dataTable([
      {label:'Holder',primary:true,sort:c=>c.holder_name,render:c=>[
        el('span',{},c.holder_name||'—'),
        el('div',{class:'cell-sub'},'Certificate ',el('span',{class:'mono'},c.cert_number))]},
      // Deliberately not sortable: certificates run in funding-date sequence,
      // and re-ordering the column would read as a renumbering.
      {label:'Cert #',hide:true,cls:'mono',render:c=>c.cert_number},
      {label:'Capital',num:true,sort:c=>c.capital_cents,render:c=>c.capital_cents!=null?money(c.capital_cents):'—'},
      {label:'% of class',num:true,sort:c=>c.pct_of_class_shown,render:c=>fmtPct(c.pct_of_class_shown)},
      {label:'Total %',num:true,sort:c=>c.total_pct_shown,render:c=>fmtPct(c.total_pct_shown)},
      {label:'Pref rate',num:true,hide:true,render:c=>c.pref_return_rate!=null?fmtRate(c.pref_return_rate):'—'},
      {label:'Accrued',num:true,hide:anyPaid,render:c=>c.accrued_calc!=null?money(c.accrued_calc):'—'},
      anyPaid?{label:'Paid',num:true,render:c=>c.pref_paid_cents?money(c.pref_paid_cents):'—'}:null,
      // What is still owed, which is what "accrued" was being read as while
      // nothing ever reduced it.
      anyPaid?{label:'Outstanding',num:true,render:c=>c.accrued_outstanding!=null?money(c.accrued_outstanding):'—'}:null,
      {label:'Issued',hide:true,render:c=>fmtDate(c.issue_date)},
      {label:'',cls:'row-actions',render:c=>rowActions(
        iconButton('print',`Print certificate ${c.cert_number}`,()=>printCertificate(offering.id,c.id)),
        iconButton('edit',`Edit certificate ${c.cert_number}`,()=>openCertificateForm(offering,investors,classNames,c,()=>refresh())),
        iconButton('trash',`Delete certificate ${c.cert_number}`,async()=>{
          const ok=await confirmDialog(`Delete certificate ${c.cert_number}?`,{danger:true,confirmLabel:'Delete'});
          if(!ok)return;await api.deleteCertificate(c.id);toast('Deleted.','success');refresh();},{danger:true}))}
    ],certs,{caption:`Certificates in ${cls}`,
      foot:el('tr',{},el('td',{dataset:{label:''},class:'rec-primary'},'Subtotal'),
        el('td',{class:'rec-hide'},''),
        el('td',{class:'num',dataset:{label:'Capital'}},money(cap)),
        el('td',{class:'num',dataset:{label:'% of class'}},fmtPct(clsPct)),
        el('td',{class:'num',dataset:{label:'Total %'}},fmtPct(totPct)),
        el('td',{class:'rec-hide'},''),
        el('td',{class:anyPaid?'num rec-hide':'num',dataset:{label:'Accrued'}},money(accr)),
        anyPaid?el('td',{class:'num',dataset:{label:'Paid'}},money(paidPref)):null,
        anyPaid?el('td',{class:'num',dataset:{label:'Outstanding'}},money(outstanding)):null,
        el('td',{class:'rec-hide'},''),el('td',{class:'rec-hide'},''))}));
}
function openCertificateForm(offering,investors,classNames,existing,onDone){
  const offeringId=typeof offering==='object'?offering.id:offering;
  const o=typeof offering==='object'?offering:(db.offerings.find(x=>x.id===Number(offeringId))||{});
  const isEdit=!!existing;
  const classOpts=[...new Set([...(o.classes||[]).map(c=>c.name),...(classNames||[])])];
  formModal({title:isEdit?'Edit certificate':'New certificate',wide:true,submitLabel:isEdit?'Save changes':'Add certificate',
    values:existing?{cert_number:existing.cert_number,investor_id:existing.investor_id??'',
      holder_name:existing.holder_name,class_name:existing.class_name,
      capital:centsToInput(existing.capital_cents),pct_of_class:existing.pct_of_class??'',percent_interest:existing.percent_interest??'',
      pref_return_rate:existing.pref_return_rate??'',accrued:centsToInput(existing.accrued_cents),
      funded_date:existing.funded_date,issue_date:existing.issue_date,sort_index:existing.sort_index??'',
      no_capital:existing.no_capital,notes:existing.notes,
      accrual_convention:existing.accrual_convention||''}
      // A new certificate opens numbered, classed and rated from the offering.
      :{cert_number:nextCertNumber(offeringId),
        class_name:inherited(scopeFor({offering:o}),'class_name')||o.security_type||'',
        pref_return_rate:inherited(scopeFor({offering:o}),'return_rate')??'',
        accrual_convention:o.accrual_convention||settings().default_accrual_convention||'',
        issue_date:defaultDate()},
    fields:[
      {name:'cert_number',label:'Certificate #',required:true,half:true,mono:true,help:'The next number in this offering. Change it if you number differently.'},
      {name:'class_name',label:'Class / series',half:true,datalist:classOpts,placeholder:'e.g. Class A Units'},
      {name:'investor_id',label:'Holder',type:'custom',
        build:val=>investorPicker(investors,val,{allowCreate:true,preferred:db.subscriptions.filter(s=>s.offering_id===Number(offeringId)).map(s=>s.investor_id),
          onPick:i=>{
            // The subscription already says what was contributed and when.
            const sub=subscriptionFor(offeringId,i.id);
            if(!sub)return;
            const cap=document.getElementById('f_capital');
            if(cap&&!cap.value&&sub.amount_committed_cents!=null)cap.value=(sub.amount_committed_cents/100).toFixed(2);
            const fd=document.getElementById('f_funded_date');
            if(fd&&!fd.value&&sub.funded_date)fd.value=sub.funded_date;
            const rate=document.getElementById('f_pref_return_rate');
            const r=inherited(scopeFor({offering:o,subscription:sub}),'return_rate');
            if(rate&&!rate.value&&r!=null)rate.value=r;
            const cls=document.getElementById('f_class_name');
            const cn=inherited(scopeFor({offering:o,subscription:sub}),'class_name');
            if(cls&&!cls.value&&cn)cls.value=cn;
          }}),
        help:'Start typing. Capital, rate, class and funding date fill from their subscription.'},
      {name:'holder_name',label:'Holder name',half:true,showIf:v=>!v.investor_id,
        help:'For a holder you do not keep in the contact book — the sponsor entity, for instance.'},
      {name:'no_capital',label:'Sponsor / non-cash certificate (no capital contributed)',type:'checkbox',help:'For units taken for holding the offering rather than for cash.'},
      {name:'capital',label:'Capital contributed',type:'money',half:true,showIf:v=>!v.no_capital,help:'Fills from the subscription when you pick a holder.'},
      {name:'pct_of_class',label:'% of class (override)',type:'number',step:'any',half:true,help:'Leave blank to pro-rate within the class by capital.'},
      {name:'percent_interest',label:'Total % ownership (override)',type:'number',step:'any',half:true,help:'Leave blank to auto-calculate.'},
      {name:'pref_return_rate',label:'Preferred return / interest rate (%)',type:'number',step:'any',half:true},
      {name:'accrual_convention',label:'Accrues',type:'select',half:true,
        options:[{value:'',label:`— As the offering says (${accrualConvention(o.accrual_convention||settings().default_accrual_convention).label}) —`},
          ...ACCRUAL_CONVENTIONS.map(c=>({value:c.value,label:c.label}))],
        help:'Recorded on this certificate, so changing the offering later leaves it alone.'},
      {name:'accrued',label:'Accrued return (override)',type:'money',half:true,help:'Leave blank to work it out from the accrual start to the as-of date.'},
      {name:'funded_date',label:'Funded date',type:'date',half:true,help:'Determines certificate order.'},
      {name:'issue_date',label:'Issue date',type:'date',half:true,help:'Auto-set to the closing date.'},
      {name:'sort_index',label:'Order #',type:'number',step:'1',half:true,help:'Override sort order within class.'},
      {name:'notes',label:'Notes',type:'textarea'}],
    onSubmit:async v=>{if(isEdit)await api.updateCertificate(existing.id,v);else await api.createCertificate(offeringId,v);
      toast(isEdit?'Certificate updated.':'Certificate added.','success');onDone?.();}});
}

async function renderInvestors(){
  const investors=await api.listInvestors();
  const addBtn=el('button',{class:'btn btn-primary',onclick:()=>openInvestorForm(null,i=>navigate(`/investors/${i.id}`))},'@icon:plus','New investor');
  const csvBtn=investors.length?el('button',{class:'btn btn-ghost',onclick:()=>exportContacts(investors)},'@icon:download','CSV'):null;
  const importBtn=el('button',{class:'btn btn-ghost',onclick:()=>openContactImport(()=>refresh())},'@icon:upload','Paste a list');
  // Group into sections by investor type; individuals shown Last, First M.
  const groups=new Map();
  for(const i of investors){const k=i.entity_type||'Other';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
  const orderedTypes=[...ENTITY_TYPE_ORDER,...[...groups.keys()].filter(k=>!ENTITY_TYPE_ORDER.includes(k))].filter(k=>groups.has(k));
  const sections=el('div',{});
  for(const type of orderedTypes){
    const rows=groups.get(type);
    sections.appendChild(el('section',{class:'panel investor-group'},
      el('div',{class:'section-head',style:'margin-top:0'},
        el('h2',{},type,el('span',{class:'muted-text',style:'font-weight:400;font-size:13px'},`  ·  ${rows.length}`))),
      dataTable([
        {label:'Name',primary:true,sort:i=>investorSortKey(i),render:i=>[
          el('span',{class:'link'},investorListName(i)),
          i.contact_name?el('div',{class:'cell-sub'},i.contact_name):null]},
        {label:'Accredited',sort:i=>i.accredited_status,render:i=>pill(i.accredited_status,ACCREDITED_KIND[i.accredited_status]||'muted')},
        {label:'Email',sort:i=>i.email,render:i=>i.email||'—'},
        {label:'Phone',hide:true,render:i=>i.phone||'—'},
        {label:'State',hide:true,sort:i=>investorState(i),render:i=>investorState(i)||'—'},
        {label:'SSN / EIN',hide:true,cls:'mono',render:i=>fmtTaxId(i.tax_id)},
        {label:'Offerings',num:true,sort:i=>i.offering_count,render:i=>String(i.offering_count)}
      ],rows,{caption:`${type} contacts`,className:'hover',
        rowAttrs:i=>({
          // The search filter reads this. It is the display name only — an
          // unmasked taxpayer ID has no business in a DOM attribute.
          dataset:{search:`${investorListName(i)} ${i.name||''} ${i.email||''} ${i.phone||''}`.toLowerCase()},
          tabindex:'0',role:'link',
          onclick:()=>navigate(`/investors/${i.id}`),
          onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(`/investors/${i.id}`);}}})})));
  }
  const search=el('input',{class:'search-input',type:'search',placeholder:'Search investors…',
    'aria-label':'Search the contact book',
    oninput:e=>{const q=e.target.value.trim().toLowerCase();
      sections.querySelectorAll('.investor-group').forEach(sec=>{let any=false;
        // [data-search] rather than `tbody tr`: the same rows, but addressed by
        // what they carry rather than by where they sit.
        sec.querySelectorAll('[data-search]').forEach(tr=>{
          const show=!q||(tr.dataset.search||'').includes(q);
          tr.style.display=show?'':'none';if(show)any=true;});
        sec.style.display=any?'':'none';});}});
  return el('div',{},pageHeader('Investors',{subtitle:`${investors.length} contact${investors.length===1?'':'s'} in your contact book`,actions:[importBtn,csvBtn,addBtn],inBar:true}),
    !investors.length?emptyState('No investors yet. Add them one at a time, or paste a list if you are bringing an existing deal in.',
      el('div',{style:'display:flex;gap:8px;justify-content:center;flex-wrap:wrap'},
        el('button',{class:'btn btn-primary',onclick:()=>openInvestorForm(null,i=>navigate(`/investors/${i.id}`))},'Add your first investor'),
        el('button',{class:'btn btn-ghost',onclick:()=>openContactImport(()=>refresh())},'Paste a list'))):
    el('div',{},el('div',{class:'toolbar'},search),sections));
}
async function renderInvestor(id){
  const inv=await api.getInvestor(id);
  const dName=investorDisplayName(inv);
  const totalCommitted=inv.subscriptions.reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  async function del(){const ok=await confirmDialog(`Delete investor “${dName}”?`,{danger:true,confirmLabel:'Delete'});if(!ok)return;
    try{await withUndo(`deleting the contact ${dName}`,()=>api.deleteInvestor(inv.id),`${dName} deleted.`);
      navigate('/investors');}catch(e){toast(e.message,'error');}}
  return el('div',{class:'view-investor'},
    pageHeader(dName,{back:{href:'#/investors',label:'All investors'},subtitle:inv.entity_type+(inv.contact_name?` · ${inv.contact_name}`:''),
      actions:[
        el('button',{class:'btn btn-ghost',onclick:()=>printInvestorStatement(inv.id)},'@icon:print','Print statement'),
        el('button',{class:'btn btn-ghost',onclick:()=>openInvestorForm(inv,()=>refresh())},'Edit'),
        el('button',{class:'btn btn-danger-ghost',onclick:del},'Delete')]}),
    el('div',{class:'grid-2'},
      el('section',{class:'panel'},el('h2',{class:'panel-title'},'Contact & accreditation'),
        detailGrid([['Type',inv.entity_type],['SSN / EIN',fmtTaxId(inv.tax_id)],
          ['Email',inv.email?el('a',{class:'link',href:`mailto:${inv.email}`},inv.email):'—'],['Phone',inv.phone],['Address',inv.address],
          ['State',investorState(inv)?stateName(investorState(inv))+(str(inv.state)?'':' (read from the address)'):null],
          ['Accredited status',pill(inv.accredited_status,ACCREDITED_KIND[inv.accredited_status]||'muted')],
          ['Verified on',fmtDate(inv.accredited_verified_date)],
          ['Established by',inv.accreditation_basis],
          ['Evidence dated',inv.accredited_evidence_date
            ?(()=>{const stale=accreditationStaleness(inv);
              return stale?el('span',{},fmtDate(inv.accredited_evidence_date),' ',pill(`${stale} days old`,'warn'))
                :fmtDate(inv.accredited_evidence_date);})()
            :null]]),
        inv.notes?el('div',{class:'notes-block'},el('h3',{},'Notes'),el('p',{},inv.notes)):null),
      el('section',{class:'panel'},el('h2',{class:'panel-title'},`Offerings — ${money(totalCommitted)} committed`),
        !inv.subscriptions.length?emptyState('Not on any offering yet.'):
        dataTable([
          {label:'Offering',primary:true,render:s=>el('span',{class:'link'},s.offering_name)},
          {label:'Status',render:s=>pill(s.status,SUBSCRIPTION_KIND[s.status]||'muted')},
          {label:'Committed',num:true,render:s=>money(s.amount_committed_cents)},
          {label:'Received',num:true,render:s=>money(Math.max(0,investorEscrow(s.offering_id,inv.id,s.id).clearedNet))}
        ],inv.subscriptions,{caption:'Offerings this investor is on',
          rowAttrs:s=>({tabindex:'0',role:'link',
            onclick:()=>navigate(`/offerings/${s.offering_id}?tab=Investors`),
            onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(`/offerings/${s.offering_id}?tab=Investors`);}}})}))));
}

