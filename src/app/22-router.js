/* ============================================================================
   ROUTER
   ========================================================================== */
const viewEl=document.getElementById('view');
const routes=[
  [/^\/?(?:\?.*)?$/,()=>renderDashboard(),'dashboard'],
  [/^\/offerings\/(\d+)(?:\?.*)?$/,m=>renderOffering(m[1]),'offerings'],
  [/^\/offerings(?:\?.*)?$/,()=>renderOfferings(),'offerings'],
  [/^\/investors\/(\d+)(?:\?.*)?$/,m=>renderInvestor(m[1]),'investors'],
  [/^\/investors(?:\?.*)?$/,()=>renderInvestors(),'investors'],
  [/^\/settings(?:\?.*)?$/,()=>renderSettings(),'settings'],
];
// What the app bar should say for a route, worked out from the record rather
// than from the URL, so a detail page names the thing you are looking at.
function routeTitle(navKey,hash){
  let m=hash.match(/^\/offerings\/(\d+)/);
  if(m){const o=db.offerings.find(x=>x.id===Number(m[1]));if(o)return o.name;}
  m=hash.match(/^\/investors\/(\d+)/);
  if(m){const i=db.investors.find(x=>x.id===Number(m[1]));if(i)return investorDisplayName(i);}
  return{dashboard:'Dashboard',offerings:'Offerings',investors:'Investors',settings:'Settings'}[navKey]||'Muniment';
}
async function router(){
  const hash=location.hash.replace(/^#/,'')||'/';
  const match=routes.find(([re])=>re.test(hash));
  const navKey=match?match[2]:'dashboard';
  // [data-nav] rather than `.nav a`: the sidebar and the bottom tab bar carry
  // the same keys, and one line lights whichever of them is on screen.
  document.querySelectorAll('[data-nav]').forEach(a=>{
    const on=a.dataset.nav===navKey;
    a.classList.toggle('active',on);
    if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const bar=document.getElementById('app-bar-title');
  if(bar)bar.textContent=routeTitle(navKey,hash);
  document.title=(navKey==='dashboard'?'Muniment':routeTitle(navKey,hash)+' · Muniment');
  clear(viewEl);viewEl.appendChild(skeleton());
  try{
    // A document that has not been opened yet has no routes worth drawing.
    if(lockedEnvelope){clear(viewEl);viewEl.appendChild(lockedView());return;}
    // match[0] is the regex, match[1] the handler, match[2] the nav key.
    const node=match?await match[1](hash.match(match[0])):notFound();
    clear(viewEl);viewEl.appendChild(node);
    // The page scrolls, not the view element — resetting viewEl.scrollTop was
    // a no-op and every navigation landed you mid-page.
    window.scrollTo(0,0);
  }catch(err){clear(viewEl);viewEl.appendChild(el('div',{class:'error-state'},
    el('h2',{},'This page could not be built'),el('p',{},err.message),
    el('button',{class:'btn btn-ghost',onclick:()=>router()},'Try again')));}
}
function notFound(){return el('div',{class:'error-state'},el('h2',{},'Page not found'),el('a',{class:'btn btn-primary',onclick:()=>location.hash='#/'},'Back to dashboard'));}
function navigate(path){if(location.hash==='#'+path)router();else location.hash=path;}
function refresh(){router();}
window.addEventListener('hashchange',router);

