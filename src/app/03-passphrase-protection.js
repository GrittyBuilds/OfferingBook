/* ============================================================================
   PASSPHRASE PROTECTION

   A subscription file holds unmasked Social Security and taxpayer numbers
   beside escrow account numbers. Masking them in lists is a courtesy to
   whoever is looking over your shoulder; it does nothing for the file itself,
   which until now was readable by anyone who could open it — in a sync folder,
   on a stolen laptop, in a backup.

   Sealed with AES-GCM under a key derived from a passphrase by PBKDF2. The key
   is derived once and held for the session: deriving it costs most of a second
   by design, and a write happens on every keystroke that lands.

   The passphrase is not stored, recorded, hinted at or recoverable. That is
   the property that makes this worth having, and the reason setting one asks
   twice and says so plainly.
   ========================================================================== */
const ENC_FORMAT='muniment-encrypted';
// OWASP's current floor for PBKDF2-HMAC-SHA256. Recorded in the envelope so a
// file sealed today still opens when the number is raised tomorrow.
const ENC_ITERATIONS=600000;
const ENC_AVAILABLE=!!(globalThis.crypto&&crypto.subtle);
function isEnvelope(o){return !!o&&typeof o==='object'&&o.format===ENC_FORMAT;}
function b64(bytes){let s='';const b=new Uint8Array(bytes);
  for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
function unb64(s){const bin=atob(String(s||''));const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}

// The derived key and the salt it was derived with. Session-only: closing the
// tab forgets them, which is the point.
let cryptoKey=null;
let cryptoSalt=null;
let cryptoIterations=ENC_ITERATIONS;
function isProtected(){return !!cryptoKey;}

async function deriveKey(passphrase,salt,iterations){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,
    {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(plaintext){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(plaintext));
  return JSON.stringify({
    format:ENC_FORMAT,v:1,app:'Muniment',
    // Written in the clear on purpose: this is what tells a future reader how
    // to open the file, and none of it weakens the key.
    note:'Encrypted with AES-GCM under a key derived from a passphrase by PBKDF2-HMAC-SHA256. Without the passphrase this file cannot be read.',
    kdf:{name:'PBKDF2',hash:'SHA-256',iterations:cryptoIterations,salt:b64(cryptoSalt)},
    iv:b64(iv),data:b64(new Uint8Array(ct))},null,2);
}
// Throws on a wrong passphrase — AES-GCM authenticates, so a wrong key fails
// rather than yielding plausible rubbish.
async function unseal(env,passphrase){
  const salt=unb64(env.kdf&&env.kdf.salt);
  const iterations=Number(env.kdf&&env.kdf.iterations)||ENC_ITERATIONS;
  const key=await deriveKey(passphrase,salt,iterations);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(env.iv)},key,unb64(env.data));
  return{text:new TextDecoder().decode(plain),key,salt,iterations};
}

// What should actually be written — sealed when a passphrase is set, plain
// when it is not.
async function storageText(){
  const plain=serialize();
  if(!cryptoKey)return plain;
  try{return await seal(plain);}
  catch(e){
    // Never fall back to writing the plaintext: a user who set a passphrase
    // would have no way of knowing the file stopped being protected.
    setSaveState('error');
    toast('Could not encrypt this change, so nothing was written. Your data is unchanged on disk.','error');
    throw e;
  }
}

/* Asking for the passphrase. Returns the decrypted text, or throws if the
   person declines — in which case the caller must leave the document alone. */
function promptPassphrase(env,{title='Unlock this data',intro,confirmLabel='Unlock'}={}){
  return new Promise((resolve,reject)=>{
    const input=el('input',{type:'password',class:'inline-input grow',autocomplete:'current-password',
      'aria-label':'Passphrase',placeholder:'Passphrase'});
    const errorBox=el('div',{class:'form-error',style:'display:none'});
    const submit=el('button',{class:'btn btn-primary',type:'submit'},confirmLabel);
    const form=el('form',{class:'modal-body form-grid',onsubmit:async e=>{
      e.preventDefault();
      if(!input.value){errorBox.textContent='Enter the passphrase.';errorBox.style.display='';return;}
      submit.disabled=true;submit.textContent='Unlocking…';
      try{
        const out=await unseal(env,input.value);
        closeModal();resolve(out);
      }catch(err){
        errorBox.textContent='That passphrase does not open this file.';errorBox.style.display='';
        submit.disabled=false;submit.textContent=confirmLabel;input.select();
      }
    }},
      el('p',{class:'field-help'},intro||'This data is protected by a passphrase. It cannot be read without it, and there is no way to recover it.'),
      errorBox,
      el('div',{class:'form-row'},el('label',{for:'passphrase-input'},'Passphrase'),input),
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-ghost',type:'button',onclick:()=>{closeModal();reject(new Error('cancelled'));}},'Cancel'),
        submit));
    input.id='passphrase-input';
    openShell(title,form);
    setTimeout(()=>input.focus(),40);
  });
}

// The sealed document found at boot, held until it is opened. While it is set,
// nothing is loaded and nothing is written — the same guard an unreadable
// document gets, for the same reason.
let lockedEnvelope=null;
async function unlockAtBoot(){
  if(!lockedEnvelope)return true;
  if(!ENC_AVAILABLE){
    setTimeout(()=>toast('This data is encrypted, and this browser does not offer the cryptography needed to open it. Nothing has been loaded and nothing will be written over it.','error'),400);
    return false;
  }
  try{
    const out=await promptPassphrase(lockedEnvelope,{
      intro:'The data held in this browser is protected by a passphrase. Nothing is loaded, and nothing will be saved over it, until it is entered.'});
    cryptoKey=out.key;cryptoSalt=out.salt;cryptoIterations=out.iterations;
    lockedEnvelope=null;
    adoptDocument(normalize(JSON.parse(out.text)));
    renderFileStatus();
    return true;
  }catch{return false;}
}
// The screen behind a document that has not been opened. It says what is
// there and offers the only thing that helps.
function lockedView(){
  return el('div',{class:'error-state'},
    el('h2',{},'This data is protected'),
    el('p',{},'The records held in this browser are encrypted. They cannot be read, and nothing will be written over them, until the passphrase is entered.'),
    el('div',{style:'display:flex;gap:8px;justify-content:center;flex-wrap:wrap'},
      el('button',{class:'btn btn-primary',onclick:async()=>{if(await unlockAtBoot())refresh();}},'Unlock…'),
      FSA?el('button',{class:'btn btn-ghost',onclick:openDataFile},'Open a different file…'):
        el('button',{class:'btn btn-ghost',onclick:importFile},'Import a different file…')));
}

// Reads a document that may be sealed, unlocking it if so. `what` names the
// source for the dialog, so "this browser" and "muniment-data.json" read
// differently to the person being asked.
async function readDocument(text,what){
  let obj;
  try{obj=JSON.parse(text);}catch{throw new Error('Not a valid Muniment data file.');}
  if(typeof obj!=='object'||obj===null)throw new Error('Not a valid Muniment data file.');
  if(!isEnvelope(obj))return normalize(obj);
  if(!ENC_AVAILABLE)throw new Error('This data is encrypted, and this browser does not offer the cryptography needed to open it.');
  const out=await promptPassphrase(obj,{
    intro:`${what||'This data'} is protected by a passphrase. It cannot be read without it, and there is no way to recover it.`});
  // Hold the key so every later write seals with the same salt.
  cryptoKey=out.key;cryptoSalt=out.salt;cryptoIterations=out.iterations;
  return normalize(JSON.parse(out.text));
}

/* Persistence */
let saveTimer=null;
let batch=null;            // the pending write everyone currently waiting shares
let batchOpened=0;         // when it opened, so a busy stretch still gets written
let writing=Promise.resolve(); // one file write at a time, never interleaved
let quotaWarned=false;
const SAVE_DEBOUNCE=250,SAVE_MAX_WAIT=1500;
function serialize(){return JSON.stringify(db,null,2);}
// The exact bytes the next file write should contain, prepared by persist().
// Sealing is asynchronous and a page being hidden is no time to start an
// encryption; the text is settled while there is still time to settle it.
let pendingText=null;

// Coalesce rapid edits into a single write, but resolve every caller only once
// a write that contains their change has completed.
function scheduleWrite(){
  if(!batch){let done;const promise=new Promise(r=>{done=r;});batch={promise,done};batchOpened=Date.now();}
  const waited=Date.now()-batchOpened;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(flushWrite,Math.max(0,Math.min(SAVE_DEBOUNCE,SAVE_MAX_WAIT-waited)));
  return batch.promise;
}
async function flushWrite(){
  const mine=batch;batch=null;
  if(!mine)return;
  writing=writing.then(async()=>{
    if(!fileHandle){setSaveState('local');return;}
    try{
      const w=await fileHandle.createWritable();
      await w.write(new Blob([pendingText??serialize()],{type:'application/json'}));
      await w.close();
      setSaveState('saved');
    }catch(e){setSaveState('error');toast('Could not save to your data file: '+e.message,'error');}
  });
  await writing;
  mine.done();
}
// A debounced write that never happens is a lost edit. When the page is being
// hidden or unloaded, write now rather than on the timer.
function flushOnExit(){
  if(!batch||readOnly)return;
  clearTimeout(saveTimer);
  flushWrite();
}
addEventListener('pagehide',flushOnExit);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushOnExit();});

/* ---- Two tabs, one document ---------------------------------------------
   Each tab holds the whole document in memory and writes it entire, so the
   later write wins and the other tab's work goes without a word. It cannot be
   merged safely — these are ledgers, not text — but it can be *noticed*: every
   write stamps a revision and a beacon, and a tab whose revision has been
   overtaken says so and stops writing until the person decides. */
const BEACON_KEY='muniment:beacon';
const TAB_ID=Math.random().toString(36).slice(2,10);
// Set when another tab has written since we last did. Nothing is saved while
// it holds, exactly as an unreadable document holds saving.
let staleTab=false;
let staleWarned=false;
function writeBeacon(){
  try{localStorage.setItem(BEACON_KEY,JSON.stringify({tab:TAB_ID,rev:db.meta.rev,at:Date.now()}));}catch{}
}
function onBeacon(){
  let b=null;
  try{b=JSON.parse(localStorage.getItem(BEACON_KEY)||'null');}catch{}
  if(!b||b.tab===TAB_ID)return;
  if((Number(b.rev)||0)<(Number(db.meta.rev)||0))return;   // we are still ahead
  staleTab=true;setSaveState('error');
  if(staleWarned)return;
  staleWarned=true;
  toast('Another tab has this data file open and has saved over what is here. Nothing more will be saved from this tab.','error',
    {label:'Load what the other tab saved',run:async()=>{
      const raw=localStorage.getItem(LS_KEY);
      if(!raw){toast('Nothing to load.','error');return;}
      try{db=parseDB(raw);staleTab=false;staleWarned=false;setSaveState('local');refresh();
        toast('Loaded. Saving has resumed.','success');}
      catch(e){toast('Could not read what the other tab saved: '+e.message,'error');}}});
}
addEventListener('storage',e=>{if(e.key===BEACON_KEY)onBeacon();});

/* ---- Generations ---------------------------------------------------------
   One copy of the file is one copy: a bad edit reaches it on the next write
   and there is nothing behind it. A short ring of previous states is kept
   beside the file handle in IndexedDB, so the state before a mistake can be
   read back. It is not a backup — it lives in the same browser — but it does
   answer the failure this app can actually cause. */
const GEN_KEEP=12;
const GEN_MIN_GAP=90000;   // at most one generation every 90 seconds
let lastGenAt=0;
async function keepGeneration(text){
  const now=Date.now();
  if(now-lastGenAt<GEN_MIN_GAP)return;
  lastGenAt=now;
  try{
    const index=(await idbGet('generations'))||[];
    const stamp=new Date(now).toISOString();
    await idbSet('gen:'+stamp,text);
    index.push({at:stamp,bytes:text.length,records:countRecords(db)});
    while(index.length>GEN_KEEP){const old=index.shift();await idbDel('gen:'+old.at);}
    await idbSet('generations',index);
  }catch{}
}

async function persist(){
  if(readOnly){toast('Saving is held: the data already in this browser could not be read. Open your data file, or import a backup, to resume.','error');return;}
  if(staleTab){toast('Saving is held: another tab has saved over this data. Load what it saved, or close this tab.','error');return;}
  db.meta.rev=(Number(db.meta.rev)||0)+1;
  // Sealed here, once, rather than inside the debounced write: this is the
  // last point at which failing to encrypt can still stop the write.
  let text;
  try{text=await storageText();}
  catch{db.meta.rev=(Number(db.meta.rev)||0)-1;return;}
  pendingText=text;
  try{localStorage.setItem(LS_KEY,text);quotaWarned=false;writeBeacon();}
  catch(e){
    // Swallowing this used to leave the dot claiming "Saved in this browser"
    // long after the browser had stopped accepting the write.
    if(!quotaWarned){quotaWarned=true;setSaveState('error');
      toast('This browser will not hold any more data. Connect a data file, or save a copy now.','error');}
  }
  keepGeneration(text);
  if(!fileHandle){setSaveState('local');return;}
  setSaveState('saving');
  await scheduleWrite();
}

/* IndexedDB (just to remember the chosen file between sessions) */
// Internal IndexedDB name kept unchanged across the rename so a previously
// connected data file still reconnects with one click after the rebrand.
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('offeringbook',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbSet(k,v){try{const d=await idbOpen();return await new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});}catch{}}
async function idbGet(k){try{const d=await idbOpen();return await new Promise((res,rej)=>{const t=d.transaction('kv','readonly');const rq=t.objectStore('kv').get(k);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});}catch{return null;}}
async function idbDel(k){try{const d=await idbOpen();return await new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);});}catch{}}

const FSA='showSaveFilePicker'in window;
// On iOS and iPadOS every browser is WebKit, so the File System Access API is
// not a different-browser away — the honest advice there is different.
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function verifyPermission(handle,rw){
  const opts={mode:rw?'readwrite':'read'};
  if((await handle.queryPermission(opts))==='granted')return true;
  if((await handle.requestPermission(opts))==='granted')return true;
  return false;
}
async function newDataFile(){
  try{
    const h=await window.showSaveFilePicker({suggestedName:'muniment-data.json',
      types:[{description:'Muniment data',accept:{'application/json':['.json']}}]});
    fileHandle=h;fileName=h.name;adoptDocument(null);await persist();await idbSet('fileHandle',h);renderFileStatus();
    toast('Data file created — your changes now save here.','success');
  }catch(e){if(e.name!=='AbortError')toast('Could not create file: '+e.message,'error');}
}
async function openDataFile(){
  try{
    const[h]=await window.showOpenFilePicker({types:[{description:'Muniment data',accept:{'application/json':['.json']}}]});
    if(!(await verifyPermission(h,true)))throw new Error('Permission to the file was denied.');
    const text=await(await h.getFile()).text();
    // Sealed files are unlocked here rather than rejected; the key is held for
    // the session so every later write seals with the same salt.
    const parsed=await readDocument(text,h.name);
    if(hasData(db)){
      const ok=await confirmDialog('Opening this file will replace the data currently loaded in this browser. Your other data file (if any) is not affected. Continue?',{danger:true,confirmLabel:'Open file'});
      if(!ok)return;
    }
    adoptDocument(parsed);fileHandle=h;fileName=h.name;await persist();await idbSet('fileHandle',h);renderFileStatus();refresh();
    toast('Data file opened.','success');
  }catch(e){if(e.name!=='AbortError')toast('Could not open file: '+e.message,'error');}
}
async function reopenFromHandle(h){
  try{
    if(!(await verifyPermission(h,true))){toast('Permission to the file was denied.','error');return;}
    const text=await(await h.getFile()).text();
    const parsed=await readDocument(text,h.name);
    // The browser mirror can legitimately be ahead of the file: a change made
    // in the last moments before the tab closed reaches localStorage
    // immediately but the file only after the write settles. Replacing
    // silently would throw that work away, so say which is which and let the
    // user choose.
    if(hasData(db)&&!sameDocument(db,parsed)){
      const mine=countRecords(db),theirs=countRecords(parsed);
      const ok=await confirmDialog(
        `The file holds ${theirs} record${theirs===1?'':'s'}; this browser holds ${mine}. Reconnecting replaces what is in the browser with what is in the file. Continue?`,
        {danger:mine>theirs,confirmLabel:'Use the file'});
      if(!ok)return;
    }
    adoptDocument(parsed);fileHandle=h;fileName=h.name;await persist();renderFileStatus();refresh();
    toast('Reconnected to '+h.name,'success');
  }catch(e){toast('Could not reopen file: '+e.message+' — it may have moved.','error');}
}
function disconnectFile(){fileHandle=null;fileName=null;idbSet('fileHandle',null);renderFileStatus();toast('Disconnected. Changes are still kept in this browser.','info');}
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);}
async function downloadCopy(){
  // A copy of a protected file is protected too, or the protection was
  // theatre: the copy is the one most likely to end up somewhere else.
  let text;
  try{text=await storageText();}catch{return;}
  const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=el('a',{href:url,download:`muniment-backup-${stamp()}.json`});document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
  // Remembered so the app can say how long it has been since the last one.
  db.settings={...db.settings,last_copy_at:nowISO()};
  persist();
  toast('Backup copy downloaded.','success');
}
function importFile(){
  const inp=el('input',{type:'file',accept:'.json,application/json'});
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    try{const parsed=await readDocument(await f.text(),f.name);
      if(hasData(db)&&!(await confirmDialog('Importing will replace the data currently loaded. Continue?',{danger:true,confirmLabel:'Import'})))return;
      adoptDocument(parsed);await persist();renderFileStatus();refresh();toast('Data imported.','success');
    }catch(e){toast('Import failed: '+e.message,'error');}};
  inp.click();
}
// Everything a user could lose, not just the two headline collections: a firm
// that has set up its settings and party directory but not yet opened an
// offering still has plenty to lose.
function countRecords(d){
  return COLLECTIONS.reduce((n,k)=>n+((d[k]&&d[k].length)||0),0)
    +Object.keys(d.settings||{}).length;
}
function hasData(d){return countRecords(d)>0;}
// Two documents that would be identical on disk need no replace warning.
function sameDocument(a,b){try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}}

let pendingHandle=null;
function setSaveState(s){
  const dot=document.querySelector('#file-status .dot');const lbl=document.querySelector('#file-status .save-label');
  if(!dot||!lbl)return;
  dot.className='dot '+s;
  lbl.textContent={saving:'Saving…',saved:'Saved to file',error:'Save failed',local:'Saved in this browser'}[s]||'';
}
function renderFileStatus(){
  const root=document.getElementById('file-status');clear(root);
  if(fileHandle){
    root.appendChild(el('div',{class:'file-line'},el('span',{class:'dot saved'}),el('span',{class:'file-name',title:fileName},fileName)));
    root.appendChild(el('div',{class:'file-sub save-label'},'Saved to file'));
    root.appendChild(el('div',{class:'file-btns'},
      el('button',{class:'mini-btn',onclick:downloadCopy},'Save a copy'),
      el('button',{class:'mini-btn',onclick:disconnectFile},'Disconnect')));
  }else if(pendingHandle){
    root.appendChild(el('div',{class:'file-line'},el('span',{class:'dot local'}),el('span',{class:'file-name'},'Not connected')));
    root.appendChild(el('div',{class:'file-sub'},'Changes are kept in this browser.'));
    root.appendChild(el('div',{class:'file-btns'},
      el('button',{class:'mini-btn',onclick:()=>reopenFromHandle(pendingHandle)},'Reconnect '+truncate(pendingHandle.name,16)),
      FSA?el('button',{class:'mini-btn',onclick:openDataFile},'Open…'):null));
  }else{
    root.appendChild(el('div',{class:'file-line'},el('span',{class:'dot local'}),el('span',{class:'file-name save-label'},'Saved in this browser')));
    if(FSA){
      root.appendChild(el('div',{class:'file-sub'},'Connect a data file to save it on your computer.'));
      root.appendChild(el('div',{class:'file-btns'},
        el('button',{class:'mini-btn',onclick:newDataFile},'New file…'),
        el('button',{class:'mini-btn',onclick:openDataFile},'Open file…'),
        el('button',{class:'mini-btn',onclick:downloadCopy},'Save a copy')));
    }else{
      root.appendChild(el('div',{class:'file-sub'},IOS
        ?'iPhones and iPads hold your records in the browser. Use “Save a copy” for backups — or open this file on a computer for autosave.'
        :'This browser can’t save to a chosen file. Use Save a copy / Import.'));
      root.appendChild(el('div',{class:'file-btns'},
        el('button',{class:'mini-btn',onclick:downloadCopy},'Save a copy'),
        el('button',{class:'mini-btn',onclick:importFile},'Import…')));
    }
  }
}
function truncate(s,n){return s.length>n?s.slice(0,n-1)+'…':s;}

/* ---- Computed summaries ------------------------------------------------- */
const SIGN={deposit:1,release:-1,refund:-1,fee:-1};
// Every amount is coerced: one null amount_cents used to turn every balance
// on every screen into $NaN, which reads as a broken app rather than a bad row.
function escrowSummary(offeringId){
  const rows=db.escrow.filter(e=>e.offering_id===offeringId);
  const by={deposit:0,release:0,refund:0,fee:0},cl={deposit:0,release:0,refund:0,fee:0};
  // hasOwnProperty rather than `in`: `in` walks the prototype, so a row typed
  // 'constructor' or 'toString' would have been accepted and added.
  for(const r of rows){if(Object.prototype.hasOwnProperty.call(by,r.txn_type)){const amt=Number(r.amount_cents)||0;
    by[r.txn_type]+=amt;if(r.cleared)cl[r.txn_type]+=amt;}}
  const book=by.deposit*SIGN.deposit+by.release*SIGN.release+by.refund*SIGN.refund+by.fee*SIGN.fee;
  const cleared=cl.deposit*SIGN.deposit+cl.release*SIGN.release+cl.refund*SIGN.refund+cl.fee*SIGN.fee;
  return{deposits:by.deposit,releases:by.release,refunds:by.refund,fees:by.fee,clearedDeposits:cl.deposit,
    // Subscriber money actually held: cleared deposits less cleared refunds.
    // This, not the gross deposit figure, is what the minimum raise is tested
    // against — a deposit that cleared and was then refunded is not raised.
    clearedNetDeposits:cl.deposit-cl.refund,clearedRefunds:cl.refund,
    bookBalance:book,clearedBalance:cleared,pendingBalance:book-cleared};
}
function subscriptionSummary(offeringId){
  const all=db.subscriptions.filter(s=>s.offering_id===offeringId);
  // A withdrawn subscription is not committed capital. It stays on the record
  // and out of every total.
  const subs=all.filter(s=>s.status!=='Withdrawn');
  const committed=subs.reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  // Scored off the effective status, so a label left behind by its own dates
  // cannot understate the signed figure on a document handed to a client.
  const signed=subs.filter(s=>['Sub signed','Funded','Closed'].includes(effectiveSubStatus(s)))
    .reduce((a,s)=>a+(s.amount_committed_cents||0),0);
  return{investorCount:subs.length,committed,signedCommitted:signed,
    withdrawnCount:all.length-subs.length,
    withdrawn:all.filter(s=>s.status==='Withdrawn').reduce((a,s)=>a+(s.amount_committed_cents||0),0)};
}
// Whole days between two calendar dates. Both ends are normalised to local
// midnight first: measuring from the current instant made the answer drift
// through the day and flip a day early either side of a DST boundary.
// Accepts a bare date or a full ISO timestamp — appending 'T00:00:00' to
// something that already carried a time produced an invalid date, and the row
// then disappeared from the dashboard rather than reporting itself.
function dayOf(dateStr){if(!dateStr)return null;const d=new Date(String(dateStr).slice(0,10)+'T00:00:00');return isNaN(d)?null:d;}
function daysUntil(dateStr,today=new Date()){
  const t=dayOf(dateStr);if(!t)return null;
  const t0=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  return Math.round((t-t0)/86400000);
}
function offeringSummary(o){
  const escrow=escrowSummary(o.id),subs=subscriptionSummary(o.id);
  const targetMin=o.target_min_cents||0;
  const raised=escrow.clearedNetDeposits;
  const minRaiseMet=targetMin>0&&raised>=targetMin;
  // Floored, not rounded: 99.6% must not read as 100% next to a badge saying
  // the minimum has not been met.
  const minRaisePct=targetMin>0?Math.min(100,Math.floor((raised/targetMin)*100)):null;
  const tasks=db.tasks.filter(t=>t.offering_id===o.id);
  const closings=db.closings.filter(c=>c.offering_id===o.id);
  const passCosts=db.subscriptions.filter(s=>s.offering_id===o.id).reduce((a,s)=>a+(s.costs_cents||0),0);
  return{escrow,subscriptions:subs,minRaiseMet,minRaisePct,daysToFinalClose:daysUntil(o.final_close_date),
    tasksTotal:tasks.length,tasksDone:tasks.filter(t=>t.done).length,passThroughCosts:passCosts,
    closingsCount:closings.length,totalReleased:closings.reduce((a,c)=>a+(c.amount_released_cents||0),0)};
}

/* ---- Certificate computation (% interest, accrued return) ---------------
   Everything here takes an as-of date. It used to measure to today and only
   to today, which meant a figure that moved every morning — including on a
   report headed with an as-of date, where the two then disagreed. "Who owned
   what on 30 June, and what had accrued by then" is the question a closing
   binder, a redemption and a distribution all begin with. */
// Whole days between two 'YYYY-MM-DD' dates (never negative). Used for accrual.
function daysBetween(fromStr,toStr){
  const a=dayOf(fromStr),b=dayOf(toStr);if(!a||!b)return null;
  return Math.max(0,Math.round((b-a)/86400000));
}
// Whole days from a date to the as-of date, defaulting to today.
function daysSince(dateStr,asOf){return daysBetween(dateStr,asOf||todayISO());}

/* ---- Accrual conventions -------------------------------------------------
   The old arithmetic was simple interest on a 365-day year, everywhere, with
   no way to say otherwise — while real preferred returns are frequently
   compounded, and frequently computed 30/360. The convention belongs beside
   the rate it modifies rather than inside the formula, so it sits on the
   class, the tranche and the offering, and every certificate written before
   this carries 'simple/365' explicitly (see MIGRATIONS). */
const ACCRUAL_CONVENTIONS=[
  {value:'simple/365',label:'Simple interest, actual/365',basis:365,compound:0},
  {value:'simple/360',label:'Simple interest, 30/360',basis:360,compound:0,thirty360:true},
  {value:'annual/365',label:'Compounded annually, actual/365',basis:365,compound:1},
  {value:'quarterly/365',label:'Compounded quarterly, actual/365',basis:365,compound:4},
  {value:'monthly/365',label:'Compounded monthly, actual/365',basis:365,compound:12},
];
const ACCRUAL_BY_VALUE=new Map(ACCRUAL_CONVENTIONS.map(c=>[c.value,c]));
function accrualConvention(v){return ACCRUAL_BY_VALUE.get(v)||ACCRUAL_BY_VALUE.get('simple/365');}
// Days on a 30/360 basis: every month is 30 days and every year 360, which is
// what a note drafted that way means by "days".
function days30360(fromStr,toStr){
  const a=dayOf(fromStr),b=dayOf(toStr);if(!a||!b||b<a)return 0;
  let d1=a.getDate(),d2=b.getDate();
  if(d1>30)d1=30;
  if(d2>30&&d1>=30)d2=30;
  return Math.max(0,(b.getFullYear()-a.getFullYear())*360+(b.getMonth()-a.getMonth())*30+(d2-d1));
}
// What has accrued on `capital` at `rate` per cent per annum between two
// dates, under the named convention. Returns cents, or null if it cannot say.
function accrue(capitalCents,rate,startDate,asOf,conventionName){
  if(capitalCents==null||rate==null||!startDate)return null;
  const conv=accrualConvention(conventionName);
  const days=conv.thirty360?days30360(startDate,asOf||todayISO()):daysBetween(startDate,asOf||todayISO());
  if(days==null)return null;
  const years=days/conv.basis;
  const r=Number(rate)/100;
  if(!isFinite(r)||!isFinite(years))return null;
  if(!conv.compound)return Math.round(capitalCents*r*years);
  // Compounded n times a year, with the final part-period accrued simply —
  // interest is not credited for a period that has not ended.
  const n=conv.compound;
  const whole=Math.floor(years*n);
  const grown=capitalCents*Math.pow(1+r/n,whole);
  const rest=years-whole/n;
  return Math.round(grown*(1+r*rest)-capitalCents);
}
// The default class that cash investors go into (first non-sponsor class).
function defaultInvestedClass(o){const cls=(o&&Array.isArray(o.classes)?o.classes:[]).filter(c=>!c.sponsor);return cls.length?cls[0].name:null;}
// What has been paid against a certificate up to a date, split between
// preferred return and capital. Accrual that has been paid is not still owed,
// which is what made the old ever-growing figure misleading.
function distributedTo(certId,asOf){
  const cut=asOf||todayISO();
  let pref=0,capital=0;
  for(const d of db.distributions){
    if(d.pay_date&&d.pay_date>cut)continue;
    for(const a of(d.allocations||[])){
      if(a.certificate_id!==certId)continue;
      pref+=Number(a.pref_cents)||0;
      capital+=Number(a.capital_cents)||0;
    }
  }
  return{pref,capital};
}
// Enrich an offering's certificates with computed % of class, total % ownership
// and accrued return as at a date. Manual per-certificate values always override.
function computeCertificates(offeringId,asOf){
  asOf=asOf||todayISO();
  const o=db.offerings.find(x=>x.id===offeringId);
  const classes=(o&&Array.isArray(o.classes))?o.classes:[];
  const classByName=new Map(classes.map(c=>[c.name,c]));
  // A certificate cancelled by a transfer or a redemption is history, not a
  // holding: it stays in the file and out of the cap table. One cancelled on
  // or before the as-of date was still live before it, which is how a roster
  // dated last June shows last June's holders.
  const raw=db.certificates.filter(c=>c.offering_id===offeringId)
    .filter(c=>!c.cancelled_date||c.cancelled_date>asOf)
    // A successor is not a holding until the transfer that created it happened.
    .filter(c=>!c.issued_by_transfer_date||c.issued_by_transfer_date<=asOf)
    .map(c=>{
      const i=db.investors.find(x=>x.id===c.investor_id);
      return{...c,holder_name:i?investorDisplayName(i):(c.holder_name||null)};});
  const classCapital={},classCount={};let totalCapital=0;
  for(const c of raw){const k=c.class_name||'Unclassified';
    classCapital[k]=(classCapital[k]||0)+(Number(c.capital_cents)||0);
    classCount[k]=(classCount[k]||0)+1;totalCapital+=(Number(c.capital_cents)||0);}
  const anyClassTotals=classes.some(c=>c.total_percent!=null);
  // What the declared classes take, and therefore what is left for the rest.
  const declaredPct=classes.reduce((a,c)=>a+(c.total_percent!=null?Number(c.total_percent)||0:0),0);
  const remainderPct=Math.max(0,100-declaredPct);
  // Capital sitting in classes that declared no share of the company.
  const undeclaredNames=new Set(Object.keys(classCapital).filter(k=>{
    const def=classByName.get(k);return !def||def.total_percent==null;}));
  const undeclaredCapital=[...undeclaredNames].reduce((a,k)=>a+(classCapital[k]||0),0);
  const enriched=raw.map(c=>{
    const k=c.class_name||'Unclassified';const def=classByName.get(c.class_name);
    const capInClass=classCapital[k]||0;
    // Investor's % share WITHIN its class: pro-rata by capital, else even split
    // (sponsor/non-cash class), else a manual override.
    let pctClass=c.pct_of_class;
    if(pctClass==null){
      // Where a class holds capital, shares are strictly pro-rata to it — a
      // no-capital certificate takes 0% of that class rather than an equal
      // share on top, which used to push the class past 100%.
      if(capInClass>0)pctClass=c.capital_cents!=null?(c.capital_cents/capInClass)*100:0;
      // A class with no capital at all — a pure sponsor class — divides evenly.
      else if(classCount[k]>0)pctClass=100/classCount[k];
      else pctClass=null;}
    // Total % ownership of the whole company.
    let totalPct=c.percent_interest; // explicit override wins
    if(totalPct==null){
      if(def&&def.total_percent!=null&&pctClass!=null)totalPct=pctClass*def.total_percent/100;
      // A class with no declared share takes a slice of whatever the declared
      // classes leave — never its within-class share reported as a share of
      // the whole company.
      else if(anyClassTotals&&pctClass!=null)
        totalPct=undeclaredCapital>0&&c.capital_cents!=null
          ? (c.capital_cents/undeclaredCapital)*remainderPct
          // No capital anywhere in the undeclared classes: split the
          // remainder evenly between them, then within by pctClass — one
          // class taking the whole remainder per certificate over-allocates.
          : pctClass*(remainderPct/Math.max(1,undeclaredNames.size))/100;
      else if(totalCapital>0&&c.capital_cents!=null)totalPct=(c.capital_cents/totalCapital)*100;
      else totalPct=pctClass;}
    // Accrued return as at the as-of date, under the convention this
    // certificate was written under — never a convention chosen later.
    const convention=c.accrual_convention||(def&&def.accrual_convention)||o&&o.accrual_convention||settings().default_accrual_convention;
    let accrued=c.accrued_cents;
    if(accrued==null){
      const start=c.accrual_start||c.issue_date||c.funded_date;
      accrued=accrue(c.capital_cents,c.pref_return_rate,start,asOf,convention);
    }
    // What distributions have already retired, so the figure on the roster is
    // what is still owed rather than everything that ever accrued.
    const paid=distributedTo(c.id,asOf);
    return{...c,pct_of_class_calc:pctClass,total_pct_calc:totalPct,accrued_calc:accrued,
      accrual_convention_calc:convention,
      pref_paid_cents:paid.pref,capital_returned_cents:paid.capital,
      // Accrued, less what has been paid against it. Never below zero: an
      // over-payment is a return of capital, and is reported as one.
      accrued_outstanding:accrued==null?null:Math.max(0,accrued-paid.pref),
      class_total_percent:def?def.total_percent:null,class_sponsor:def?!!def.sponsor:false};});
  const classOrder=new Map(classes.map((c,idx)=>[c.name,idx]));
  enriched.sort((a,b)=>{
    const ao=classOrder.has(a.class_name)?classOrder.get(a.class_name):999;
    const bo=classOrder.has(b.class_name)?classOrder.get(b.class_name):999;
    if(ao!==bo)return ao-bo;
    const ac=a.class_name||'~',bc=b.class_name||'~';if(ac!==bc)return ac.localeCompare(bc);
    const asi=a.sort_index??1e9,bsi=b.sort_index??1e9;if(asi!==bsi)return asi-bsi;
    return String(a.cert_number||'').localeCompare(String(b.cert_number||''),undefined,{numeric:true});});
  // A cap table whose percentage column reads 99.9999% is taken by whoever is
  // holding it as an error in the document, not as the rounding artefact it
  // is. The displayed figures are settled here, by largest remainder, so the
  // column closes exactly on what it is a share of.
  settlePercentages(enriched,'total_pct_calc','total_pct_shown',
    anyClassTotals?Math.min(100,declaredPct+(undeclaredNames.size?remainderPct:0)):100);
  for(const name of new Set(enriched.map(c=>c.class_name||'Unclassified')))
    settlePercentages(enriched.filter(c=>(c.class_name||'Unclassified')===name),
      'pct_of_class_calc','pct_of_class_shown',100);
  return{offering:o,classes,certificates:enriched,classCapital,classCount,totalCapital,asOf,
    hasClassTotals:anyClassTotals,classNames:[...new Set(raw.map(c=>c.class_name).filter(Boolean))]};
}

