import { el, money, fmtDate, pill, toast } from '../util.js';
import { api } from '../api.js';
import { pageHeader, detailGrid, emptyState } from '../components.js';
import { confirmDialog } from '../modal.js';
import { openInvestorForm } from '../forms.js';
import { navigate, refresh } from '../app.js';
import { ACCREDITED_KIND, SUBSCRIPTION_KIND } from '../constants.js';

export async function renderInvestor(id) {
  const inv = await api.getInvestor(id);

  const totalCommitted = inv.subscriptions.reduce((a, s) => a + (s.amount_committed_cents || 0), 0);

  return el('div', { class: 'view-investor' },
    pageHeader(inv.name, {
      back: { href: '#/investors', label: 'All investors' },
      subtitle: inv.entity_type + (inv.contact_name ? ` · ${inv.contact_name}` : ''),
      actions: [
        el('button', { class: 'btn btn-ghost', onclick: () => openInvestorForm(inv, () => refresh()) }, 'Edit'),
        el('button', { class: 'btn btn-danger-ghost', onclick: () => del(inv) }, 'Delete'),
      ],
    }),
    el('div', { class: 'grid-2' },
      el('section', { class: 'panel' },
        el('h2', { class: 'panel-title' }, 'Contact & accreditation'),
        detailGrid([
          ['Email', inv.email ? el('a', { href: `mailto:${inv.email}`, class: 'link' }, inv.email) : '—'],
          ['Phone', inv.phone],
          ['Address', inv.address],
          ['Accredited status', pill(inv.accredited_status, ACCREDITED_KIND[inv.accredited_status] || 'muted')],
          ['Verified on', fmtDate(inv.accredited_verified_date)],
        ]),
        inv.notes ? el('div', { class: 'notes-block' }, el('h3', {}, 'Notes'), el('p', {}, inv.notes)) : null,
      ),
      el('section', { class: 'panel' },
        el('h2', { class: 'panel-title' }, `Offerings — ${money(totalCommitted)} committed`),
        !inv.subscriptions.length
          ? emptyState('Not on any offering yet.')
          : el('table', { class: 'data-table' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Offering'), el('th', {}, 'Status'), el('th', { class: 'num' }, 'Committed'))),
            el('tbody', {}, ...inv.subscriptions.map((s) => el('tr', {
              onclick: () => navigate(`/offerings/${s.offering_id}?tab=Investors`),
            },
              el('td', {}, el('span', { class: 'link' }, s.offering_name)),
              el('td', {}, pill(s.status, SUBSCRIPTION_KIND[s.status] || 'muted')),
              el('td', { class: 'num' }, money(s.amount_committed_cents)),
            ))),
          ),
      ),
    ),
  );

  async function del(inv) {
    const ok = await confirmDialog(`Delete investor “${inv.name}”?`, { danger: true, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.deleteInvestor(inv.id);
      toast('Investor deleted.', 'success');
      navigate('/investors');
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}
