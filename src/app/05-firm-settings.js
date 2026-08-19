/* ============================================================================
   FIRM SETTINGS — the constants that are true of the practice, not of one deal.
   Entered once in Settings; every new offering starts from them.
   ========================================================================== */
const DEFAULT_REPORT_FOOTER='Not an offering document, not a filing, and not a substitute for the executed instruments. Figures are unaudited.';
const SETTINGS_DEFAULTS={
  firm_name:null,firm_address:null,firm_contact:null,
  report_footer:DEFAULT_REPORT_FOOTER,
  default_exemption:null,default_security_type:null,default_return_rate:null,
  default_costs_label:'Legal & professional fees',default_min_investment:null,
  default_escrow_party_id:null,
  checklist_template:null,          // null → DEFAULT_CHECKLIST
  automation:'propose',             // 'propose' | 'off'
  mask_account_numbers:1,
  date_defaults:1,                  // date fields open on today
  // Asked once, at the first record, and remembered either way — see
  // maybeOfferDataFile(). Not a preference so much as a question already put.
  file_prompt_answered:0,
  // When a copy was last downloaded, so the app can say how long it has been.
  last_copy_at:null,
  // How new certificates are numbered on an offering that does not say
  // otherwise. See formatCertNumber().
  default_cert_number_format:null,
  // The accrual convention new offerings start from. See ACCRUAL_CONVENTIONS.
  default_accrual_convention:'simple/365'
};
function settings(){return{...SETTINGS_DEFAULTS,...(db.settings||{})};}

