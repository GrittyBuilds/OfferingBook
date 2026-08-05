// Thin REST client. Every call returns parsed JSON or throws with the
// server's error message.

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Dashboard
  dashboard: () => request('GET', '/dashboard'),

  // Offerings
  listOfferings: () => request('GET', '/offerings'),
  getOffering: (id) => request('GET', `/offerings/${id}`),
  createOffering: (data) => request('POST', '/offerings', data),
  updateOffering: (id, data) => request('PUT', `/offerings/${id}`, data),
  deleteOffering: (id) => request('DELETE', `/offerings/${id}`),

  // Investors
  listInvestors: () => request('GET', '/investors'),
  getInvestor: (id) => request('GET', `/investors/${id}`),
  createInvestor: (data) => request('POST', '/investors', data),
  updateInvestor: (id, data) => request('PUT', `/investors/${id}`, data),
  deleteInvestor: (id) => request('DELETE', `/investors/${id}`),

  // Subscriptions
  listSubscriptions: (offeringId) => request('GET', `/offerings/${offeringId}/subscriptions`),
  createSubscription: (offeringId, data) =>
    request('POST', `/offerings/${offeringId}/subscriptions`, data),
  updateSubscription: (id, data) => request('PUT', `/subscriptions/${id}`, data),
  deleteSubscription: (id) => request('DELETE', `/subscriptions/${id}`),

  // Escrow
  listEscrow: (offeringId) => request('GET', `/offerings/${offeringId}/escrow`),
  createEscrow: (offeringId, data) => request('POST', `/offerings/${offeringId}/escrow`, data),
  updateEscrow: (id, data) => request('PUT', `/escrow/${id}`, data),
  deleteEscrow: (id) => request('DELETE', `/escrow/${id}`),

  // Tasks
  listTasks: (offeringId) => request('GET', `/offerings/${offeringId}/tasks`),
  createTask: (offeringId, data) => request('POST', `/offerings/${offeringId}/tasks`, data),
  updateTask: (id, data) => request('PUT', `/tasks/${id}`, data),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),

  // Reconciliations
  listReconciliations: (offeringId) => request('GET', `/offerings/${offeringId}/reconciliations`),
  createReconciliation: (offeringId, data) =>
    request('POST', `/offerings/${offeringId}/reconciliations`, data),
  deleteReconciliation: (id) => request('DELETE', `/reconciliations/${id}`),

  // Backup
  backupPath: () => request('GET', '/backup/path'),
};
