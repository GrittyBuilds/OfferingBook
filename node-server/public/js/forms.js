import { formModal } from './modal.js';
import { api } from './api.js';
import { toast, centsToInput } from './util.js';
import {
  OFFERING_STATUSES, EXEMPTIONS, SECURITY_TYPES, ENTITY_TYPES,
  ACCREDITED_STATUSES, SUBSCRIPTION_STATUSES, TXN_TYPES, PAYMENT_METHODS,
} from './constants.js';

// ---- Offering --------------------------------------------------------------

export function openOfferingForm(existing, onDone) {
  const isEdit = !!existing;
  formModal({
    title: isEdit ? 'Edit offering' : 'New offering',
    wide: true,
    submitLabel: isEdit ? 'Save changes' : 'Create offering',
    values: existing ? {
      name: existing.name, issuer_name: existing.issuer_name,
      exemption: existing.exemption, security_type: existing.security_type,
      status: existing.status,
      target_min: centsToInput(existing.target_min_cents),
      target_max: centsToInput(existing.target_max_cents),
      price_per_unit: centsToInput(existing.price_per_unit_cents),
      min_investment: centsToInput(existing.min_investment_cents),
      launch_date: existing.launch_date, first_close_date: existing.first_close_date,
      final_close_date: existing.final_close_date, form_d_filed_date: existing.form_d_filed_date,
      escrow_agent: existing.escrow_agent, escrow_bank: existing.escrow_bank,
      escrow_account_number: existing.escrow_account_number, notes: existing.notes,
    } : { status: 'Drafting' },
    fields: [
      { name: 'name', label: 'Offering name', required: true, placeholder: 'e.g. Acme Fund I' },
      { name: 'issuer_name', label: 'Issuer / client', half: true, placeholder: 'Issuing entity' },
      { name: 'status', label: 'Status', type: 'select', options: OFFERING_STATUSES, half: true },
      { name: 'exemption', label: 'Exemption', type: 'select', options: ['', ...EXEMPTIONS], half: true },
      { name: 'security_type', label: 'Security type', type: 'select', options: ['', ...SECURITY_TYPES], half: true },
      { name: 'target_min', label: 'Minimum raise (min-raise)', type: 'money', half: true, help: 'Escrow must reach this before a closing.' },
      { name: 'target_max', label: 'Maximum raise', type: 'money', half: true },
      { name: 'price_per_unit', label: 'Price per unit', type: 'money', half: true },
      { name: 'min_investment', label: 'Minimum investment', type: 'money', half: true },
      { name: 'launch_date', label: 'Launch date', type: 'date', half: true },
      { name: 'form_d_filed_date', label: 'Form D filed', type: 'date', half: true },
      { name: 'first_close_date', label: 'First / interim close', type: 'date', half: true },
      { name: 'final_close_date', label: 'Final close deadline', type: 'date', half: true },
      { name: 'escrow_agent', label: 'Escrow agent', half: true, placeholder: 'Escrow company' },
      { name: 'escrow_bank', label: 'Escrow bank', half: true },
      { name: 'escrow_account_number', label: 'Escrow account #', half: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSubmit: async (v) => {
      const saved = isEdit
        ? await api.updateOffering(existing.id, v)
        : await api.createOffering(v);
      toast(isEdit ? 'Offering updated.' : 'Offering created.', 'success');
      onDone?.(saved);
    },
  });
}

// ---- Investor --------------------------------------------------------------

export function openInvestorForm(existing, onDone) {
  const isEdit = !!existing;
  formModal({
    title: isEdit ? 'Edit investor' : 'New investor',
    wide: true,
    submitLabel: isEdit ? 'Save changes' : 'Add investor',
    values: existing || { entity_type: 'Individual', accredited_status: 'Unknown' },
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'Investor or entity name' },
      { name: 'entity_type', label: 'Type', type: 'select', options: ENTITY_TYPES, half: true },
      { name: 'contact_name', label: 'Contact person', half: true, help: 'For entities/trusts' },
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'phone', label: 'Phone', type: 'tel', half: true },
      { name: 'accredited_status', label: 'Accredited status', type: 'select', options: ACCREDITED_STATUSES, half: true },
      { name: 'accredited_verified_date', label: 'Verified on', type: 'date', half: true },
      { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSubmit: async (v) => {
      const saved = isEdit
        ? await api.updateInvestor(existing.id, v)
        : await api.createInvestor(v);
      toast(isEdit ? 'Investor updated.' : 'Investor added.', 'success');
      onDone?.(saved);
    },
  });
}

// ---- Subscription ----------------------------------------------------------

export function openSubscriptionForm(offeringId, investors, existing, onDone) {
  const isEdit = !!existing;
  formModal({
    title: isEdit ? 'Edit subscription' : 'Add investor to offering',
    submitLabel: isEdit ? 'Save changes' : 'Add',
    values: existing ? {
      investor_id: existing.investor_id,
      amount_committed: centsToInput(existing.amount_committed_cents),
      units: existing.units ?? '',
      status: existing.status,
      sub_sent_date: existing.sub_sent_date,
      sub_signed_date: existing.sub_signed_date,
      notes: existing.notes,
    } : { status: 'Prospect' },
    fields: [
      {
        name: 'investor_id', label: 'Investor', type: 'select', required: true,
        options: [{ value: '', label: '— Select investor —' },
          ...investors.map((i) => ({ value: i.id, label: i.name }))],
        help: investors.length ? null : 'Add investors on the Investors tab first.',
      },
      { name: 'amount_committed', label: 'Amount committed', type: 'money', half: true },
      { name: 'units', label: 'Units', type: 'number', half: true, step: 'any' },
      { name: 'status', label: 'Status', type: 'select', options: SUBSCRIPTION_STATUSES, half: true },
      { name: 'sub_sent_date', label: 'Sub agreement sent', type: 'date', half: true },
      { name: 'sub_signed_date', label: 'Sub agreement signed', type: 'date', half: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSubmit: async (v) => {
      if (isEdit) await api.updateSubscription(existing.id, v);
      else await api.createSubscription(offeringId, v);
      toast(isEdit ? 'Subscription updated.' : 'Investor added to offering.', 'success');
      onDone?.();
    },
  });
}

// ---- Escrow transaction ----------------------------------------------------

export function openEscrowForm(offeringId, investors, existing, onDone) {
  const isEdit = !!existing;
  formModal({
    title: isEdit ? 'Edit escrow entry' : 'New escrow entry',
    submitLabel: isEdit ? 'Save changes' : 'Add entry',
    values: existing ? {
      txn_type: existing.txn_type,
      investor_id: existing.investor_id ?? '',
      amount: centsToInput(existing.amount_cents),
      txn_date: existing.txn_date,
      method: existing.method,
      reference: existing.reference,
      cleared: existing.cleared ? 'yes' : 'no',
      notes: existing.notes,
    } : { txn_type: 'deposit', cleared: 'no' },
    fields: [
      { name: 'txn_type', label: 'Type', type: 'select', options: TXN_TYPES, half: true },
      { name: 'amount', label: 'Amount', type: 'money', required: true, half: true },
      {
        name: 'investor_id', label: 'Investor', type: 'select',
        options: [{ value: '', label: '— None (issuer / fee) —' },
          ...investors.map((i) => ({ value: i.id, label: i.name }))],
        help: 'Link deposits/refunds to the investor; leave blank for releases and fees.',
        half: true,
      },
      { name: 'txn_date', label: 'Date', type: 'date', half: true },
      { name: 'method', label: 'Method', type: 'select', options: ['', ...PAYMENT_METHODS], half: true },
      { name: 'cleared', label: 'Cleared at bank?', type: 'select', options: [{ value: 'no', label: 'Pending' }, { value: 'yes', label: 'Cleared' }], half: true },
      { name: 'reference', label: 'Reference / check #', half: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSubmit: async (v) => {
      const payload = { ...v, cleared: v.cleared === 'yes' };
      if (isEdit) await api.updateEscrow(existing.id, payload);
      else await api.createEscrow(offeringId, payload);
      toast('Escrow entry saved.', 'success');
      onDone?.();
    },
  });
}
