import { el, money, fmtDate, relDays, pill } from '../util.js';
import { api } from '../api.js';
import { pageHeader, emptyState, progressBar } from '../components.js';
import { openOfferingForm } from '../forms.js';
import { navigate } from '../app.js';
import { OFFERING_STATUS_KIND } from '../constants.js';

export async function renderOfferings() {
  const offerings = await api.listOfferings();

  const newBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => openOfferingForm(null, (o) => navigate(`/offerings/${o.id}`)),
  }, '+ New offering');

  return el('div', {},
    pageHeader('Offerings', {
      subtitle: `${offerings.length} offering${offerings.length === 1 ? '' : 's'}`,
      actions: [newBtn],
    }),
    !offerings.length
      ? emptyState('No offerings yet.', el('button', {
        class: 'btn btn-primary',
        onclick: () => openOfferingForm(null, (o) => navigate(`/offerings/${o.id}`)),
      }, 'Create your first offering'))
      : el('div', { class: 'card-grid' }, ...offerings.map(offeringCard)),
  );
}

function offeringCard(o) {
  const s = o.summary;
  const days = s.daysToFinalClose;
  return el('div', {
    class: 'offering-card',
    onclick: () => navigate(`/offerings/${o.id}`),
  },
    el('div', { class: 'oc-head' },
      el('div', {},
        el('h3', { class: 'oc-name' }, o.name),
        el('div', { class: 'oc-issuer' }, o.issuer_name || '—'),
      ),
      pill(o.status, OFFERING_STATUS_KIND[o.status] || 'default'),
    ),
    el('div', { class: 'oc-tags' },
      o.exemption ? el('span', { class: 'tag' }, o.exemption) : null,
      o.security_type ? el('span', { class: 'tag' }, o.security_type) : null,
    ),
    el('div', { class: 'oc-escrow' },
      el('div', {},
        el('span', { class: 'oc-escrow-val' }, money(s.escrow.clearedBalance)),
        el('span', { class: 'oc-escrow-lbl' }, ' in escrow'),
      ),
      o.target_min_cents
        ? el('span', { class: `oc-minraise ${s.minRaiseMet ? 'met' : ''}` },
          s.minRaiseMet ? '✓ Min-raise met' : `${s.minRaisePct}% of min`)
        : null,
    ),
    o.target_min_cents ? progressBar(s.minRaisePct, { met: s.minRaiseMet }) : null,
    el('div', { class: 'oc-foot' },
      el('span', {}, `${s.subscriptions.investorCount} investor${s.subscriptions.investorCount === 1 ? '' : 's'}`),
      days !== null && !['Closed', 'Terminated'].includes(o.status)
        ? el('span', { class: days <= 14 && days >= 0 ? 'urgent-text' : '' },
          `Close ${relDays(days)}`)
        : el('span', {}, fmtDate(o.final_close_date)),
    ),
  );
}
