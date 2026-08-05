// Shared option lists and status → color mappings.

export const OFFERING_STATUSES = [
  'Drafting', 'Filed', 'Open', 'Closing', 'Closed', 'Terminated',
];

export const OFFERING_STATUS_KIND = {
  Drafting: 'default',
  Filed: 'info',
  Open: 'success',
  Closing: 'warn',
  Closed: 'muted',
  Terminated: 'danger',
};

export const EXEMPTIONS = [
  'Reg D 506(b)', 'Reg D 506(c)', 'Reg D 504', 'Reg A+ Tier 1', 'Reg A+ Tier 2',
  'Reg CF', 'Reg S', 'Section 4(a)(2)', 'Intrastate', 'Other',
];

export const SECURITY_TYPES = [
  'Common Equity', 'Preferred Equity', 'LLC Units', 'LP Interests',
  'Promissory Note', 'Convertible Note', 'SAFE', 'Revenue Share', 'Other',
];

export const ENTITY_TYPES = ['Individual', 'Entity', 'Trust', 'Joint', 'IRA / Retirement'];

export const ACCREDITED_STATUSES = [
  'Unknown', 'Self-certified', 'Verified', 'Not accredited',
];

export const ACCREDITED_KIND = {
  Unknown: 'muted',
  'Self-certified': 'info',
  Verified: 'success',
  'Not accredited': 'danger',
};

export const SUBSCRIPTION_STATUSES = [
  'Prospect', 'Sub sent', 'Sub signed', 'Funded', 'Closed', 'Withdrawn',
];

export const SUBSCRIPTION_KIND = {
  Prospect: 'muted',
  'Sub sent': 'info',
  'Sub signed': 'warn',
  Funded: 'success',
  Closed: 'success',
  Withdrawn: 'danger',
};

export const TXN_TYPES = [
  { value: 'deposit', label: 'Deposit (investor → escrow)' },
  { value: 'release', label: 'Release (escrow → issuer)' },
  { value: 'refund', label: 'Refund (escrow → investor)' },
  { value: 'fee', label: 'Fee / expense (escrow → out)' },
];

export const TXN_KIND = { deposit: 'success', release: 'info', refund: 'warn', fee: 'muted' };

export const PAYMENT_METHODS = ['Wire', 'Check', 'ACH', 'Other'];
