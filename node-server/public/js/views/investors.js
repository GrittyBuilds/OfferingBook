import { el, pill } from '../util.js';
import { api } from '../api.js';
import { pageHeader, emptyState } from '../components.js';
import { openInvestorForm } from '../forms.js';
import { navigate } from '../app.js';
import { ACCREDITED_KIND } from '../constants.js';

export async function renderInvestors() {
  const investors = await api.listInvestors();

  const addBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => openInvestorForm(null, (i) => navigate(`/investors/${i.id}`)),
  }, '+ New investor');

  const search = el('input', {
    class: 'search-input', type: 'search', placeholder: 'Search investors…',
    oninput: (e) => {
      const q = e.target.value.toLowerCase();
      tbody.querySelectorAll('tr').forEach((tr) => {
        tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
      });
    },
  });

  const tbody = el('tbody', {}, ...investors.map(rowFor));

  return el('div', {},
    pageHeader('Investors', {
      subtitle: `${investors.length} contact${investors.length === 1 ? '' : 's'}`,
      actions: [addBtn],
    }),
    !investors.length
      ? emptyState('No investors yet.', el('button', {
        class: 'btn btn-primary',
        onclick: () => openInvestorForm(null, (i) => navigate(`/investors/${i.id}`)),
      }, 'Add your first investor'))
      : el('div', {},
        el('div', { class: 'toolbar' }, search),
        el('table', { class: 'data-table hover' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Name'), el('th', {}, 'Type'), el('th', {}, 'Email'),
            el('th', {}, 'Phone'), el('th', {}, 'Accredited'), el('th', { class: 'num' }, 'Offerings'))),
          tbody),
      ),
  );
}

function rowFor(i) {
  return el('tr', {
    dataset: { search: `${i.name} ${i.email || ''} ${i.phone || ''}`.toLowerCase() },
    onclick: () => navigate(`/investors/${i.id}`),
  },
    el('td', {}, el('span', { class: 'link' }, i.name)),
    el('td', {}, i.entity_type),
    el('td', {}, i.email || '—'),
    el('td', {}, i.phone || '—'),
    el('td', {}, pill(i.accredited_status, ACCREDITED_KIND[i.accredited_status] || 'muted')),
    el('td', { class: 'num' }, String(i.offering_count)),
  );
}
