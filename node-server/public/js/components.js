import { el } from './util.js';

/** Page header with a title, optional subtitle, and right-aligned actions. */
export function pageHeader(title, { subtitle, actions, back } = {}) {
  return el('header', { class: 'page-head' },
    el('div', {},
      back ? el('a', { class: 'back-link', href: back.href }, '← ' + back.label) : null,
      el('h1', {}, title),
      subtitle ? el('p', { class: 'page-sub' }, subtitle) : null,
    ),
    actions ? el('div', { class: 'page-actions' }, ...actions) : null,
  );
}

/** A headline metric card. */
export function statCard(label, value, { sub, kind } = {}) {
  return el('div', { class: `stat-card ${kind ? 'stat-' + kind : ''}` },
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, value),
    sub ? el('div', { class: 'stat-sub' }, sub) : null,
  );
}

/** Progress bar 0–100 with optional "met" styling. */
export function progressBar(pct, { met = false } = {}) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  return el('div', { class: 'progress' },
    el('div', {
      class: `progress-fill ${met ? 'met' : ''}`,
      style: `width:${clamped}%`,
    })
  );
}

export function emptyState(message, actionNode) {
  return el('div', { class: 'empty' },
    el('p', {}, message),
    actionNode || null);
}

/** Definition-list style key/value grid. */
export function detailGrid(pairs) {
  return el('dl', { class: 'detail-grid' },
    ...pairs.filter(Boolean).flatMap(([k, v]) => [
      el('dt', {}, k),
      el('dd', {}, v ?? '—'),
    ]));
}
