/* ============================================================================
   SUGGESTIONS — shown, never applied on their own.
   ========================================================================== */
function suggestionCard(s,onDone){
  const accept=s.apply?el('button',{class:'btn btn-primary btn-sm',type:'button',onclick:async()=>{
    try{await api.acceptSuggestion(s);toast('Recorded.','success');onDone();}
    catch(e){toast(e.message,'error');}}},'@icon:check','Accept'):null;
  const open=!s.apply&&s.offeringId?el('button',{class:'btn btn-ghost btn-sm',type:'button',
    onclick:()=>navigate(`/offerings/${s.offeringId}`)},'Open'):null;
  const dismiss=el('button',{class:'icon-btn',type:'button','aria-label':'Dismiss this suggestion',
    title:'Dismiss',onclick:async()=>{await api.dismissSuggestion(s);onDone();}},'@icon:close');
  return el('div',{class:'suggest-card'+(s.severity==='warn'?' warn':'')},
    el('span',{class:'suggest-mark'},s.severity==='warn'?'@icon:warning':'@icon:sparkle'),
    el('div',{class:'suggest-body'},
      el('div',{class:'suggest-title'},s.title),
      el('div',{class:'suggest-detail'},s.detail),
      s.evidence?el('span',{class:'suggest-evidence'},s.evidence):null),
    el('div',{class:'suggest-actions'},accept,open,dismiss));
}
// `scope` is an offering id, or null for everything.
// Sorted before it is cut. With the exemption checks in, the strip is long
// enough that whatever sits in the first five decides what gets seen — and a
// Form D running out of days should not be below a nudge about letterhead.
// Within a severity the order the checks ran in is kept, which groups them by
// offering and reads as the file does.
const SUGGEST_RANK={warn:0,info:1};
function bySeverity(list){
  return list.map((s,i)=>[s,i]).sort((a,b)=>
    (SUGGEST_RANK[a[0].severity]??1)-(SUGGEST_RANK[b[0].severity]??1)||a[1]-b[1]).map(x=>x[0]);
}
function suggestionPanel(scope,onDone,{limit=6,heading='Suggested'}={}){
  const all=bySeverity(computeSuggestions(scope));
  if(!all.length)return null;
  let expanded=false;
  const shown=all.slice(0,limit);
  const applicable=all.filter(s=>s.apply);
  const acceptAll=applicable.length>1?el('button',{class:'btn btn-ghost btn-sm',type:'button',onclick:async()=>{
    const ok=await confirmDialog(`Accept all ${applicable.length} suggestions? Each one writes the change it describes. You can review them afterwards under Settings.`,{confirmLabel:'Accept all'});
    if(!ok)return;
    // Recomputed between applies: an accepted change can retire or reshape
    // the ones after it, and a retired suggestion must not run stale.
    let done=0,failed=0;
    for(const key of applicable.map(s=>s.key)){
      const fresh=computeSuggestions(scope).find(x=>x.key===key&&x.apply);
      if(!fresh)continue;
      try{await fresh.apply();logActivity('accepted',fresh.title,fresh.offeringId,fresh.key);done++;}
      catch{failed++;}
    }
    await persist();
    toast(failed?`${done} recorded; ${failed} could not be applied.`:(done?`${done} change${done===1?'':'s'} recorded.`:'Nothing left to record.'),failed?'error':'success');
    onDone();
  }},`Accept all ${applicable.length}`):null;
  return el('section',{class:'panel suggest-panel'},
    el('div',{class:'suggest-head'},
      el('h2',{class:'panel-title',style:'margin:0;border:none;padding:0'},heading,
        el('span',{class:'muted-text',style:'font-weight:400;letter-spacing:0;text-transform:none;margin-left:8px'},
          `${all.length} thing${all.length===1?'':'s'} the record can already fill in`)),
      acceptAll),
    (()=>{
      const list=el('div',{class:'suggest'},...shown.map(s=>suggestionCard(s,onDone)));
      const more=all.length>shown.length
        ?el('button',{class:'btn btn-ghost btn-sm',style:'margin-top:10px',type:'button',onclick:()=>{
            expanded=!expanded;
            clear(list);
            (expanded?all:shown).forEach(s=>list.appendChild(suggestionCard(s,onDone)));
            more.textContent=expanded?'Show fewer':`Show all ${all.length}`;
          }},`Show all ${all.length}`)
        :null;
      return el('div',{},list,more);
    })());
}

