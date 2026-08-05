import { el, clear, money, moneyShort, fmtDate, relDays, pill, toast } from '../util.js';
import { api } from '../api.js';
import { pageHeader, statCard, progressBar, emptyState, detailGrid } from '../components.js';
import { confirmDialog } from '../modal.js';
import { openOfferingForm, openSubscriptionForm, openEscrowForm } from '../forms.js';
import { navigate, refresh } from '../app.js';
import {
  OFFERING_STATUS_KIND, SUBSCRIPTION_KIND, TXN_KIND, ACCREDITED_KIND,
} from '../constants.js';

const TABS = ['Overview', 'Investors', 'Escrow', 'Checklist', 'Reconciliation'];

export async function renderOffering(id) {
  const [offering, investors] = await Promise.all([
    api.getOffering(id),
    api.listInvestors(),
  ]);

  const state = { offering, investors, tab: currentTab() };

  const tabContent = el('div', { class: 'tab-content' });
  const tabBar = el('nav', { class: 'tab-bar' },
    ...TABS.map((t) => el('button', {
      class: 'tab' + (t === state.tab ? ' active' : ''),
      onclick: () => selectTab(t),
    }, t)),
  );

  function selectTab(t) {
    state.tab = t;
    // Update the URL silently (no hashchange → no full re-render) so tab
    // switches stay snappy but a reload/back still restores the tab.
    history.replaceState(null, '', `#/offerings/${id}` + (t === 'Overview' ? '' : `?tab=${t}`));
    tabBar.querySelectorAll('.tab').forEach((b) =>
      b.classList.toggle('active', b.textContent === t));
    drawTab();
  }

  async function reloadOffering() {
    state.offering = await api.getOffering(id);
    header.replaceWith((header = buildHeader()));
  }

  async function drawTab() {
    clear(tabContent);
    tabContent.appendChild(el('div', { class: 'loading' }, 'Loading…'));
    const render = {
      Overview: () => overviewTab(state, reloadOffering),
      Investors: () => investorsTab(state, drawTab, reloadOffering),
      Escrow: () => escrowTab(state, drawTab, reloadOffering),
      Checklist: () => checklistTab(state),
      Reconciliation: () => reconciliationTab(state),
    }[state.tab];
    const node = await render();
    clear(tabContent);
    tabContent.appendChild(node);
  }

  let header = buildHeader();
  function buildHeader() {
    const o = state.offering;
    const s = o.summary;
    return el('div', {},
      pageHeader(o.name, {
        back: { href: '#/offerings', label: 'All offerings' },
        subtitle: o.issuer_name || undefined,
        actions: [
          el('button', { class: 'btn btn-ghost', onclick: () =>
            openOfferingForm(o, () => reloadOffering()) }, 'Edit'),
          el('button', { class: 'btn btn-danger-ghost', onclick: () => deleteOffering(o) }, 'Delete'),
        ],
      }),
      el('div', { class: 'offering-summary-row' },
        el('div', { class: 'osr-item' }, pill(o.status, OFFERING_STATUS_KIND[o.status] || 'default')),
        o.exemption ? el('div', { class: 'osr-item' }, el('span', { class: 'tag' }, o.exemption)) : null,
        el('div', { class: 'osr-item' },
          el('strong', {}, money(s.escrow.clearedBalance)), el('span', { class: 'muted-text' }, ' in escrow')),
        o.target_min_cents ? el('div', { class: 'osr-item' },
          s.minRaiseMet ? pill('Min-raise met', 'success') : pill(`${s.minRaisePct}% of min-raise`, 'warn')) : null,
        s.daysToFinalClose !== null && !['Closed', 'Terminated'].includes(o.status)
          ? el('div', { class: 'osr-item' + (s.daysToFinalClose <= 14 && s.daysToFinalClose >= 0 ? ' urgent-text' : '') },
            `Closes ${relDays(s.daysToFinalClose)}`)
          : null,
      ),
    );
  }

  async function deleteOffering(o) {
    const ok = await confirmDialog(
      `Delete “${o.name}” and all its investors-on-offering, escrow entries, checklist and reconciliations? This cannot be undone.`,
      { danger: true, confirmLabel: 'Delete offering' });
    if (!ok) return;
    await api.deleteOffering(o.id);
    toast('Offering deleted.', 'success');
    navigate('/offerings');
  }

  const root = el('div', { class: 'view-offering' }, header, tabBar, tabContent);
  drawTab();
  return root;
}

function currentTab() {
  const m = location.hash.match(/[?&]tab=([^&]+)/);
  const t = m ? decodeURIComponent(m[1]) : 'Overview';
  return TABS.includes(t) ? t : 'Overview';
}

// ---- Overview --------------------------------------------------------------

function overviewTab(state) {
  const o = state.offering;
  const s = o.summary;
  return el('div', { class: 'grid-2' },
    el('section', { class: 'panel' },
      el('h2', { class: 'panel-title' }, 'Offering details'),
      detailGrid([
        ['Issuer / client', o.issuer_name],
        ['Exemption', o.exemption],
        ['Security type', o.security_type],
        ['Price per unit', o.price_per_unit_cents != null ? money(o.price_per_unit_cents) : null],
        ['Minimum investment', o.min_investment_cents != null ? money(o.min_investment_cents) : null],
        ['Minimum raise', o.target_min_cents != null ? money(o.target_min_cents) : null],
        ['Maximum raise', o.target_max_cents != null ? money(o.target_max_cents) : null],
        ['Launch date', fmtDate(o.launch_date)],
        ['Form D filed', fmtDate(o.form_d_filed_date)],
        ['First / interim close', fmtDate(o.first_close_date)],
        ['Final close deadline', fmtDate(o.final_close_date)],
      ]),
      o.notes ? el('div', { class: 'notes-block' }, el('h3', {}, 'Notes'), el('p', {}, o.notes)) : null,
    ),
    el('div', {},
      el('section', { class: 'panel' },
        el('h2', { class: 'panel-title' }, 'Closing readiness'),
        o.target_min_cents ? el('div', {},
          el('div', { class: 'readiness-figures' },
            el('span', {}, `${money(s.escrow.clearedDeposits)} cleared`),
            el('span', { class: 'muted-text' }, ` of ${money(o.target_min_cents)} minimum`),
          ),
          progressBar(s.minRaisePct, { met: s.minRaiseMet }),
          el('div', { class: 'readiness-note' },
            s.minRaiseMet
              ? pill('✓ Minimum raise met — closing can proceed', 'success')
              : pill(`${money(o.target_min_cents - s.escrow.clearedDeposits)} more needed to close`, 'warn')),
        ) : el('p', { class: 'muted-text' }, 'Set a minimum raise on this offering to track closing readiness.'),
      ),
      el('section', { class: 'panel' },
        el('h2', { class: 'panel-title' }, 'Escrow snapshot'),
        el('div', { class: 'stat-row compact' },
          statCard('Cleared balance', money(s.escrow.clearedBalance), { kind: 'accent' }),
          statCard('Pending', money(s.escrow.pendingBalance)),
          statCard('Book balance', money(s.escrow.bookBalance)),
        ),
        el('dl', { class: 'detail-grid' },
          el('dt', {}, 'Escrow agent'), el('dd', {}, o.escrow_agent || '—'),
          el('dt', {}, 'Escrow bank'), el('dd', {}, o.escrow_bank || '—'),
          el('dt', {}, 'Account #'), el('dd', {}, o.escrow_account_number || '—'),
        ),
      ),
      el('section', { class: 'panel' },
        el('h2', { class: 'panel-title' }, 'Process'),
        el('div', { class: 'progress-inline' },
          progressBar(s.tasksTotal ? Math.round((s.tasksDone / s.tasksTotal) * 100) : 0),
          el('span', { class: 'progress-label' }, `${s.tasksDone}/${s.tasksTotal} steps done`),
        ),
      ),
    ),
  );
}

// ---- Investors (subscriptions) --------------------------------------------

async function investorsTab(state, drawTab, reloadOffering) {
  const subs = await api.listSubscriptions(state.offering.id);
  const committed = subs.reduce((a, s) => a + (s.amount_committed_cents || 0), 0);

  const addBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => openSubscriptionForm(state.offering.id, state.investors, null, async () => {
      await reloadOffering(); drawTab();
    }),
  }, '+ Add investor');

  return el('div', {},
    el('div', { class: 'section-head' },
      el('h2', {}, `Investors — ${money(committed)} committed`),
      addBtn,
    ),
    !subs.length
      ? emptyState('No investors on this offering yet.',
        state.investors.length ? null : el('a', { href: '#/investors', class: 'btn btn-ghost' }, 'Add investors to your contact book first'))
      : el('table', { class: 'data-table' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Investor'), el('th', {}, 'Accredited'), el('th', {}, 'Status'),
          el('th', { class: 'num' }, 'Committed'), el('th', { class: 'num' }, 'Units'),
          el('th', {}, 'Signed'), el('th', {}, ''))),
        el('tbody', {}, ...subs.map((s) => el('tr', {},
          el('td', {},
            el('a', { href: `#/investors/${s.investor_id}`, class: 'link' }, s.investor_name),
            el('div', { class: 'cell-sub' }, s.email || s.phone || s.entity_type)),
          el('td', {}, pill(s.accredited_status, ACCREDITED_KIND[s.accredited_status] || 'muted')),
          el('td', {}, pill(s.status, SUBSCRIPTION_KIND[s.status] || 'muted')),
          el('td', { class: 'num' }, money(s.amount_committed_cents)),
          el('td', { class: 'num' }, s.units ?? '—'),
          el('td', {}, fmtDate(s.sub_signed_date)),
          el('td', { class: 'row-actions' },
            el('button', { class: 'icon-btn', title: 'Edit', onclick: () =>
              openSubscriptionForm(state.offering.id, state.investors, s, async () => { await reloadOffering(); drawTab(); }) }, '✎'),
            el('button', { class: 'icon-btn danger', title: 'Remove', onclick: async () => {
              const ok = await confirmDialog(`Remove ${s.investor_name} from this offering?`, { danger: true, confirmLabel: 'Remove' });
              if (!ok) return;
              await api.deleteSubscription(s.id); toast('Removed.', 'success'); await reloadOffering(); drawTab();
            } }, '🗑'),
          ),
        ))),
      ),
  );
}

// ---- Escrow ----------------------------------------------------------------

async function escrowTab(state, drawTab, reloadOffering) {
  const { transactions, summary } = await api.listEscrow(state.offering.id);

  const addBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => openEscrowForm(state.offering.id, state.investors, null, async () => { await reloadOffering(); drawTab(); }),
  }, '+ New entry');

  return el('div', {},
    el('div', { class: 'stat-row' },
      statCard('Cleared balance', money(summary.clearedBalance), { kind: 'accent', sub: 'settled at bank' }),
      statCard('Pending', money(summary.pendingBalance), { sub: 'not yet cleared' }),
      statCard('Deposits', money(summary.deposits), { kind: 'success' }),
      statCard('Out (release/refund/fee)', money(summary.releases + summary.refunds + summary.fees), { sub: `${money(summary.releases)} released` }),
    ),
    el('div', { class: 'section-head' }, el('h2', {}, 'Escrow ledger'), addBtn),
    !transactions.length
      ? emptyState('No escrow activity recorded yet.')
      : el('table', { class: 'data-table' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Date'), el('th', {}, 'Type'), el('th', {}, 'Investor'),
          el('th', {}, 'Method / ref'), el('th', {}, 'Cleared'),
          el('th', { class: 'num' }, 'Amount'), el('th', {}, ''))),
        el('tbody', {}, ...transactions.map((t) => {
          const outbound = t.txn_type !== 'deposit';
          return el('tr', {},
            el('td', {}, fmtDate(t.txn_date)),
            el('td', {}, pill(t.txn_type, TXN_KIND[t.txn_type] || 'muted')),
            el('td', {}, t.investor_name || '—'),
            el('td', {}, [t.method, t.reference].filter(Boolean).join(' · ') || '—'),
            el('td', {},
              el('button', {
                class: `clear-toggle ${t.cleared ? 'on' : ''}`,
                title: 'Toggle cleared',
                onclick: async () => {
                  await api.updateEscrow(t.id, {
                    txn_type: t.txn_type, investor_id: t.investor_id, amount: (t.amount_cents / 100).toFixed(2),
                    txn_date: t.txn_date, method: t.method, reference: t.reference,
                    cleared: !t.cleared, notes: t.notes,
                  });
                  await reloadOffering(); drawTab();
                },
              }, t.cleared ? '✓ Cleared' : 'Pending')),
            el('td', { class: 'num ' + (outbound ? 'neg' : 'pos') },
              (outbound ? '−' : '+') + money(t.amount_cents)),
            el('td', { class: 'row-actions' },
              el('button', { class: 'icon-btn', title: 'Edit', onclick: () =>
                openEscrowForm(state.offering.id, state.investors, t, async () => { await reloadOffering(); drawTab(); }) }, '✎'),
              el('button', { class: 'icon-btn danger', title: 'Delete', onclick: async () => {
                const ok = await confirmDialog('Delete this escrow entry?', { danger: true, confirmLabel: 'Delete' });
                if (!ok) return;
                await api.deleteEscrow(t.id); toast('Deleted.', 'success'); await reloadOffering(); drawTab();
              } }, '🗑'),
            ),
          );
        })),
      ),
  );
}

// ---- Checklist -------------------------------------------------------------

async function checklistTab(state) {
  const tasks = await api.listTasks(state.offering.id);
  const done = tasks.filter((t) => t.done).length;

  const list = el('ul', { class: 'checklist' });
  function drawList(items) {
    clear(list);
    items.forEach((t) => list.appendChild(taskRow(t, items)));
  }

  function taskRow(t, items) {
    return el('li', { class: 'check-item' + (t.done ? ' done' : '') },
      el('label', { class: 'check-label' },
        el('input', {
          type: 'checkbox', checked: !!t.done,
          onchange: async (e) => {
            await api.updateTask(t.id, { done: e.target.checked });
            t.done = e.target.checked ? 1 : 0;
            e.target.closest('.check-item').classList.toggle('done', !!t.done);
            countLabel.textContent = `${items.filter((x) => x.done).length}/${items.length} complete`;
          },
        }),
        el('span', { class: 'check-text' }, t.label),
      ),
      el('div', { class: 'check-right' },
        t.due_date ? el('span', { class: 'check-due' }, 'Due ' + fmtDate(t.due_date)) : null,
        el('button', { class: 'icon-btn danger', title: 'Delete step', onclick: async () => {
          await api.deleteTask(t.id);
          const idx = items.indexOf(t); if (idx >= 0) items.splice(idx, 1);
          drawList(items);
          countLabel.textContent = `${items.filter((x) => x.done).length}/${items.length} complete`;
        } }, '🗑'),
      ),
    );
  }

  const newInput = el('input', { class: 'inline-input', placeholder: 'Add a step…', type: 'text' });
  const dueInput = el('input', { class: 'inline-input date', type: 'date', title: 'Optional due date' });
  const countLabel = el('span', { class: 'count-label' }, `${done}/${tasks.length} complete`);

  async function addTask() {
    const label = newInput.value.trim();
    if (!label) return;
    const created = await api.createTask(state.offering.id, { label, due_date: dueInput.value || null });
    tasks.push(created);
    newInput.value = ''; dueInput.value = '';
    drawList(tasks);
    countLabel.textContent = `${tasks.filter((x) => x.done).length}/${tasks.length} complete`;
    newInput.focus();
  }
  newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

  drawList(tasks);

  return el('section', { class: 'panel' },
    el('div', { class: 'section-head' }, el('h2', {}, 'Process checklist'), countLabel),
    list,
    el('div', { class: 'add-task-row' },
      newInput, dueInput,
      el('button', { class: 'btn btn-primary btn-sm', onclick: addTask }, 'Add step'),
    ),
  );
}

// ---- Reconciliation --------------------------------------------------------

async function reconciliationTab(state) {
  const { reconciliations, summary } = await api.listReconciliations(state.offering.id);

  const dateInput = el('input', { type: 'date', class: 'inline-input date' });
  const balInput = el('input', { type: 'text', class: 'inline-input money-input', placeholder: '0.00', inputmode: 'decimal' });
  const notesInput = el('input', { type: 'text', class: 'inline-input grow', placeholder: 'Notes (optional)' });

  async function addRecon() {
    if (!balInput.value.trim()) { toast('Enter the statement balance.', 'error'); return; }
    await api.createReconciliation(state.offering.id, {
      statement_date: dateInput.value || null,
      statement_balance: balInput.value,
      notes: notesInput.value || null,
    });
    toast('Reconciliation saved.', 'success');
    refresh();
  }

  return el('div', {},
    el('section', { class: 'panel' },
      el('h2', { class: 'panel-title' }, 'Reconcile to bank statement'),
      el('p', { class: 'muted-text' },
        'The app tracks a cleared book balance of ',
        el('strong', {}, money(summary.clearedBalance)),
        '. Enter your escrow bank statement balance to check they agree.'),
      el('div', { class: 'recon-form' },
        el('div', { class: 'recon-field' }, el('label', {}, 'Statement date'), dateInput),
        el('div', { class: 'recon-field' }, el('label', {}, 'Statement balance'),
          el('div', { class: 'money-wrap' }, el('span', { class: 'money-prefix' }, '$'), balInput)),
        el('div', { class: 'recon-field grow' }, el('label', {}, 'Notes'), notesInput),
        el('button', { class: 'btn btn-primary', onclick: addRecon }, 'Check'),
      ),
    ),
    el('section', { class: 'panel' },
      el('h2', { class: 'panel-title' }, 'Reconciliation history'),
      !reconciliations.length
        ? emptyState('No reconciliations recorded yet.')
        : el('table', { class: 'data-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Statement date'), el('th', { class: 'num' }, 'Statement balance'),
            el('th', { class: 'num' }, 'App cleared balance'), el('th', { class: 'num' }, 'Difference'),
            el('th', {}, 'Notes'), el('th', {}, ''))),
          el('tbody', {}, ...reconciliations.map((r) => {
            const appBal = r.statement_balance_cents - r.difference_cents;
            const matched = r.difference_cents === 0;
            return el('tr', {},
              el('td', {}, fmtDate(r.statement_date)),
              el('td', { class: 'num' }, money(r.statement_balance_cents)),
              el('td', { class: 'num' }, money(appBal)),
              el('td', { class: 'num' },
                matched ? pill('✓ Matches', 'success')
                  : pill((r.difference_cents > 0 ? '+' : '−') + money(Math.abs(r.difference_cents)), 'danger')),
              el('td', {}, r.notes || '—'),
              el('td', { class: 'row-actions' },
                el('button', { class: 'icon-btn danger', title: 'Delete', onclick: async () => {
                  await api.deleteReconciliation(r.id); toast('Deleted.', 'success'); refresh();
                } }, '🗑')),
            );
          })),
        ),
    ),
  );
}
