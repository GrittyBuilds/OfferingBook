import { el, clear, toast } from './util.js';
import { api } from './api.js';
import { renderDashboard } from './views/dashboard.js';
import { renderOfferings } from './views/offerings.js';
import { renderOffering } from './views/offering.js';
import { renderInvestors } from './views/investors.js';
import { renderInvestor } from './views/investor.js';

const view = document.getElementById('view');

// Route table: [regex, handler(params), navKey]
// Detail routes tolerate a trailing ?query (used for the active tab).
const routes = [
  [/^\/?(?:\?.*)?$/, () => renderDashboard(), 'dashboard'],
  [/^\/offerings\/(\d+)(?:\?.*)?$/, (m) => renderOffering(m[1]), 'offerings'],
  [/^\/offerings(?:\?.*)?$/, () => renderOfferings(), 'offerings'],
  [/^\/investors\/(\d+)(?:\?.*)?$/, (m) => renderInvestor(m[1]), 'investors'],
  [/^\/investors(?:\?.*)?$/, () => renderInvestors(), 'investors'],
];

async function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const match = routes.find(([re]) => re.test(hash));

  // Highlight active nav item.
  const navKey = match ? match[2] : 'dashboard';
  document.querySelectorAll('.nav a').forEach((a) =>
    a.classList.toggle('active', a.dataset.nav === navKey));

  clear(view);
  view.appendChild(el('div', { class: 'loading' }, 'Loading…'));

  try {
    const node = match ? await match[1](hash.match(match[0])) : notFound();
    clear(view);
    view.appendChild(node);
    view.scrollTop = 0;
  } catch (err) {
    clear(view);
    view.appendChild(el('div', { class: 'error-state' },
      el('h2', {}, 'Something went wrong'),
      el('p', {}, err.message)));
  }
}

function notFound() {
  return el('div', { class: 'error-state' },
    el('h2', {}, 'Page not found'),
    el('a', { href: '#/', class: 'btn btn-primary' }, 'Back to dashboard'));
}

/** Programmatic navigation. */
export function navigate(path) {
  if (location.hash === '#' + path) router();
  else location.hash = path;
}

/** Re-render the current route (after create/update/delete). */
export function refresh() {
  router();
}

// Backup button in the sidebar.
document.getElementById('backup-btn').addEventListener('click', () => {
  // Trigger a file download of the whole database.
  window.location.href = '/api/backup';
  toast('Downloading a backup copy of your database…', 'success');
});

// Show where the live DB lives, for manual copies.
api.backupPath().then(({ path }) => {
  const node = document.getElementById('db-path');
  node.textContent = path;
  node.title = 'Your data lives in this file. Copy it anywhere to back up.';
}).catch(() => {});

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
router();
