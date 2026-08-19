/* ============================================================================
   BOOT
   ========================================================================== */
async function boot(){
  initTheme();
  // Load the browser mirror, falling back to data saved under any previous app name.
  let raw=localStorage.getItem(LS_KEY);
  if(!raw){for(const k of LS_KEYS_OLD){const old=localStorage.getItem(k);if(old){raw=old;break;}}}
  if(raw){
    // Sealed is not the same as unreadable: it needs a passphrase, not a
    // rescue. Saving is held either way, so a document that could not be read
    // is never replaced by an empty one.
    let head=null;
    try{head=JSON.parse(raw);}catch{}
    if(isEnvelope(head)){
      lockedEnvelope=head;readOnly=true;
    }else{
      try{db=parseDB(raw);}
      catch(e){
        // Never overwrite data we failed to read. The unreadable copy is set
        // aside under its own key and saving is held until the user decides.
        const stash=`muniment:unreadable:${Date.now()}`;
        try{localStorage.setItem(stash,raw);}catch{}
        db=EMPTY();readOnly=true;
        setTimeout(()=>toast(`The saved data in this browser could not be read, so nothing has been loaded and nothing will be saved over it. A copy is held under ${stash}.`,'error'),400);
      }
    }
  }
  // Try to remember a previously connected file (needs a click to re-grant).
  if(FSA){try{const h=await idbGet('fileHandle');if(h)pendingHandle=h;}catch{}}
  renderFileStatus();
  const addBtn=document.getElementById('global-add');if(addBtn)addBtn.addEventListener('click',openQuickAdd);
  // The phone chrome: centre add, More sheet, and the search button share the
  // same machinery the desktop reaches by keyboard.
  const bottomAdd=document.getElementById('bottom-add');if(bottomAdd)bottomAdd.addEventListener('click',openQuickAdd);
  const bottomMore=document.getElementById('bottom-more');if(bottomMore)bottomMore.addEventListener('click',openMoreSheet);
  const appMore=document.getElementById('app-more');if(appMore)appMore.addEventListener('click',openMoreSheet);
  const appSearch=document.getElementById('app-search');if(appSearch)appSearch.addEventListener('click',openPalette);
  // Drawn before the passphrase is asked for, so the screen behind the box
  // says what is going on. A blank page behind it reads as an empty file,
  // which is the one thing this document is not.
  await router();
  if(lockedEnvelope&&await unlockAtBoot())await router();
  // After the first paint, so a notice never delays the record appearing.
  setTimeout(()=>{if(!readOnly)backupStalenessNotice();},1200);
}
boot();
