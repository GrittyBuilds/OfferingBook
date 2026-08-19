/* ============================================================================
   CSV

   There was no export of any kind. The roster, the escrow ledger and the cap
   table all eventually have to leave the app for somebody with a spreadsheet,
   and a JSON backup is not that.

   The columns are declared here rather than borrowed from the screen: a table
   column renders nodes for a person to look at, and a CSV column carries a
   value for a machine to add up. Sharing them would mean stripping markup
   back out of the one to make the other.
   ========================================================================== */
// Excel reads a leading =, +, - or @ as a formula, so a value that starts with
// one is prefixed with a quote. A cap table is not a place to execute anything.
function csvCell(v){
  if(v===null||v===undefined)return '';
  let s=String(v);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function toCSV(columns,rows){
  const head=columns.map(c=>csvCell(c.label)).join(',');
  const body=rows.map(r=>columns.map(c=>csvCell(c.value(r))).join(','));
  // CRLF and a BOM: what Excel expects, and what stops it mangling accents.
  return '﻿'+[head,...body].join('\r\n')+'\r\n';
}
function downloadCSV(filename,text){
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=el('a',{href:url,download:filename});document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
  toast(`${filename} downloaded.`,'success');
}
// Money leaves as a plain decimal number, not a formatted string: a
// spreadsheet should be able to add the column up.
const csvMoney=c=>c===null||c===undefined?'':(c/100).toFixed(2);
function csvFilename(offering,what){
  const slug=String((offering&&offering.name)||'muniment').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'muniment';
  return `${slug}-${what}-${todayISO()}.csv`;
}

function exportRoster(offering,subs){
  downloadCSV(csvFilename(offering,'roster'),toCSV([
    {label:'Investor',value:s=>s.investor_name},
    {label:'Type',value:s=>s.entity_type},
    {label:'Status',value:s=>s.status},
    {label:'Accredited',value:s=>s.accredited_status},
    {label:'Email',value:s=>s.email},
    {label:'Phone',value:s=>s.phone},
    {label:'Committed',value:s=>csvMoney(s.amount_committed_cents)},
    {label:'Received',value:s=>csvMoney(Math.max(0,investorEscrow(offering.id,s.investor_id,s.id).clearedNet))},
    {label:'Costs',value:s=>csvMoney(s.costs_cents)},
    {label:'Units',value:s=>s.units},
    {label:'Tranche',value:s=>{const t=(offering.tranches||[]).find(x=>x.id===s.tranche_id);return t?t.name:'';}},
    {label:'Subscription sent',value:s=>s.sub_sent_date},
    {label:'Subscription signed',value:s=>s.sub_signed_date},
    {label:'Funded',value:s=>s.funded_date},
    {label:'Notes',value:s=>s.notes},
  ],subs));
}
function exportEscrow(offering,transactions){
  downloadCSV(csvFilename(offering,'escrow'),toCSV([
    {label:'Date',value:t=>t.txn_date},
    {label:'Type',value:t=>t.txn_type},
    {label:'Investor',value:t=>t.investor_name},
    {label:'Amount',value:t=>csvMoney(t.amount_cents)},
    // Signed, so a spreadsheet can total the column into a balance.
    {label:'Signed amount',value:t=>csvMoney((SIGN[t.txn_type]||0)*(t.amount_cents||0))},
    {label:'Cleared',value:t=>t.cleared?'Yes':'No'},
    {label:'Method',value:t=>t.method},
    {label:'Reference',value:t=>t.reference},
    {label:'Notes',value:t=>t.notes},
  ],transactions));
}
function exportCapTable(offering,data){
  downloadCSV(csvFilename(offering,'cap-table'),toCSV([
    {label:'Certificate',value:c=>c.cert_number},
    {label:'Holder',value:c=>c.holder_name},
    {label:'Class',value:c=>c.class_name},
    {label:'Capital',value:c=>csvMoney(c.capital_cents)},
    {label:'% of class',value:c=>c.pct_of_class_shown},
    {label:'% of issuer',value:c=>c.total_pct_shown},
    {label:'Preferred rate',value:c=>c.pref_return_rate},
    {label:'Accrues',value:c=>accrualConvention(c.accrual_convention_calc).label},
    {label:'Accrued',value:c=>csvMoney(c.accrued_calc)},
    {label:'Paid',value:c=>csvMoney(c.pref_paid_cents)},
    {label:'Outstanding',value:c=>csvMoney(c.accrued_outstanding)},
    {label:'Funded',value:c=>c.funded_date},
    {label:'Issued',value:c=>c.issue_date},
    {label:'As at',value:()=>data.asOf},
  ],data.certificates));
}
function exportContacts(investors){
  downloadCSV(`muniment-contacts-${todayISO()}.csv`,toCSV([
    {label:'Name',value:i=>investorListName(i)},
    {label:'Type',value:i=>i.entity_type},
    {label:'Contact',value:i=>i.contact_name},
    {label:'Email',value:i=>i.email},
    {label:'Phone',value:i=>i.phone},
    {label:'Address',value:i=>i.address},
    {label:'State',value:i=>investorState(i)},
    // Taxpayer numbers are the reason this file needs looking after; they are
    // masked here as they are everywhere else, and the note says so.
    {label:'SSN / EIN (masked)',value:i=>fmtTaxId(i.tax_id)},
    {label:'Accredited',value:i=>i.accredited_status},
    {label:'Established by',value:i=>i.accreditation_basis},
    {label:'Verified',value:i=>i.accredited_verified_date},
    {label:'Evidence dated',value:i=>i.accredited_evidence_date},
    {label:'Offerings',value:i=>i.offering_count},
  ],investors));
}

