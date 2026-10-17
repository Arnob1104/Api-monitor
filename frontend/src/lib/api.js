const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error(`Can't reach the backend at ${BASE}. Start it with "npm run dev" in the backend folder.`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
  return body;
}

export const api = {
  getAlerts: (status = 'active') => request(`/alerts?status=${status}&limit=200`),
  getStats: () => request('/alerts/stats'),
  runMonitor: (records) => request('/monitor', { method: 'POST', body: JSON.stringify(records) }),
  runSample: () => request('/monitor/sample', { method: 'POST' }),
  resolve: (id) => request(`/alerts/${id}/resolve`, { method: 'PATCH' }),
  emailReport: () => request('/alerts/report', { method: 'POST' }),
};
