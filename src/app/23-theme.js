/* ============================================================================
   THEME — light is the default; the choice is remembered per browser.
   ========================================================================== */
const SUN='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-9.5a.7.7 0 0 1 .7.7v1a.7.7 0 0 1-1.4 0v-1a.7.7 0 0 1 .7-.7Zm0 11.6a.7.7 0 0 1 .7.7v1a.7.7 0 0 1-1.4 0v-1a.7.7 0 0 1 .7-.7ZM1.5 8a.7.7 0 0 1 .7-.7h1a.7.7 0 0 1 0 1.4h-1A.7.7 0 0 1 1.5 8Zm11.3 0a.7.7 0 0 1 .7-.7h1a.7.7 0 0 1 0 1.4h-1a.7.7 0 0 1-.7-.7ZM3.3 3.3a.7.7 0 0 1 1 0l.7.7a.7.7 0 1 1-1 1l-.7-.7a.7.7 0 0 1 0-1Zm7.7 7.7a.7.7 0 0 1 1 0l.7.7a.7.7 0 0 1-1 1l-.7-.7a.7.7 0 0 1 0-1Zm1.7-7.7a.7.7 0 0 1 0 1l-.7.7a.7.7 0 1 1-1-1l.7-.7a.7.7 0 0 1 1 0ZM5 11a.7.7 0 0 1 0 1l-.7.7a.7.7 0 0 1-1-1l.7-.7a.7.7 0 0 1 1 0Z"/></svg>';
const MOON='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a.6.6 0 0 0-.83-.7A6.9 6.9 0 1 0 14.1 10.4a.6.6 0 0 0-.7-.83Z"/></svg>';
function applyTheme(t){
  const theme=t==='dark'?'dark':'light';
  document.documentElement.setAttribute('data-theme',theme);
  try{localStorage.setItem(THEME_KEY,theme);}catch{}
  const b=document.getElementById('theme-toggle');
  if(b){
    b.innerHTML=(theme==='dark'?MOON:SUN)+'<span>'+(theme==='dark'?'Dark':'Light')+'</span>';
    b.setAttribute('aria-pressed',theme==='dark'?'true':'false');
    b.title=theme==='dark'?'Switch to light':'Switch to dark';
  }
}
function initTheme(){
  let t='light';
  try{t=localStorage.getItem(THEME_KEY)||'light';}catch{}
  applyTheme(t);
  const b=document.getElementById('theme-toggle');
  if(b)b.addEventListener('click',()=>applyTheme(
    document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));
}

