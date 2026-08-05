// Tiny DOM + formatting helpers. No framework — just functions that build nodes.

/**
 * Hyperscript helper: el('div', { class: 'x', onclick: fn }, child, child...)
 * - props starting with 'on' become event listeners
 * - `html` prop sets innerHTML (use sparingly, only with trusted content)
 * - children may be nodes, strings, numbers, arrays, or null/false (skipped)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node && k !== 'list') {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    } else {
      node.setAttribute(k, v);
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---- Money -----------------------------------------------------------------

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

/** cents (integer) -> "$1,234.56"; null/undefined -> "—" */
export function money(cents) {
  if (cents === null || cents === undefined) return '—';
  return usd.format(cents / 100);
}

/** cents -> "$1,235" (no decimals) for headline figures */
export function moneyShort(cents) {
  if (cents === null || cents === undefined) return '—';
  return usd0.format(cents / 100);
}

/** cents -> "1234.56" for pre-filling a dollar input */
export function centsToInput(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

// ---- Dates -----------------------------------------------------------------

/** "2026-09-30" -> "Sep 30, 2026"; passthrough for empty */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Human "in 12 days" / "3 days ago" / "today" from a day count. */
export function relDays(days) {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `${-days} day${days === -1 ? '' : 's'} ago`;
}

// ---- Misc ------------------------------------------------------------------

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Colored status pill. */
export function pill(text, kind = 'default') {
  return el('span', { class: `pill pill-${kind}` }, text);
}

/** Toast notification. */
export function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  const t = el('div', { class: `toast toast-${kind}` }, message);
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}
