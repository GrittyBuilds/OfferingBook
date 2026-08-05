import { el, moneyShort, money, fmtDate, relDays, pill } from '../util.js';
import { api } from '../api.js';
import { pageHeader, statCard, emptyState } from '../components.js';
import { openOfferingForm } from '../forms.js';
import { navigate } from '../app.js';
import { OFFERING_STATUS_KIND } from '../constants.js';

export async function renderDashboard() {
  const [d, offerings] = await Promise.all([api.dashboard(), api.listOfferings()]);

  const newBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => openOfferingForm(null, (o) => navigate(`/offerings/${o.id}`)),
  }, '+ New offering');

  const container = el('div', { class: 'view-dashboard' },
    pageHeader('Dashboard', {
      subtitle: 'Your practice at a glance.',
      actions: [newBtn],
    }),
    el('div', { class: 'stat-row' },
      statCard('Active offerings', d.activeCount, { sub: `${d.offeringCount} total` }),
      statCard('In escrow (cleared)', moneyShort(d.totalInEscrow), { kind: 'accent', sub: 'across all offerings' }),
      statCard('Total committed', moneyShort(d.totalCommitted), { sub: 'subscribed by investors' }),
      statCard('Investors', d.investorCount, { sub: 'in your contact book' }),
      statCard('Min-raise met', d.minRaiseMetCount, { kind: d.minRaiseMetCount ? 'success' : undefined, sub: 'offerings cleared to close' }),
    ),
    el('div', { class: 'dash-cols' },
      upcomingClosings(d.upcomingClosings),
      recentOfferings(offerings),
    ),
  );
  return container;
}

function upcomingClosings(list) {
  return el('section', { class: 'panel' },
    el('h2', { class: 'panel-title' }, 'Upcoming closings'),
    !list.length
      ? emptyState('No closing deadlines set.')
      : el('ul', { class: 'closing-list' },
        ...list.map((c) => el('li', {
          class: 'closing-item' + (c.days <= 14 ? ' urgent' : ''),
          onclick: () => navigate(`/offerings/${c.id}`),
        },
          el('div', { class: 'closing-main' },
            el('span', { class: 'closing-name' }, c.name),
            el('span', { class: 'closing-date' }, `${fmtDate(c.final_close_date)} · ${relDays(c.days)}`),
          ),
          c.minRaiseMet
            ? pill('Min-raise met', 'success')
            : pill('Below min-raise', 'warn'),
        )),
      ),
  );
}

function recentOfferings(offerings) {
  return el('section', { class: 'panel' },
    el('h2', { class: 'panel-title' }, 'Offerings'),
    !offerings.length
      ? emptyState('No offerings yet — create your first one.')
      : el('ul', { class: 'mini-list' },
        ...offerings.slice(0, 8).map((o) => el('li', {
          class: 'mini-item',
          onclick: () => navigate(`/offerings/${o.id}`),
        },
          el('div', { class: 'mini-main' },
            el('span', { class: 'mini-name' }, o.name),
            el('span', { class: 'mini-meta' }, o.issuer_name || '—'),
          ),
          el('div', { class: 'mini-right' },
            el('span', { class: 'mini-escrow' }, money(o.summary.escrow.clearedBalance)),
            pill(o.status, OFFERING_STATUS_KIND[o.status] || 'default'),
          ),
        )),
      ),
  );
}
