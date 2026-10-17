import { useMemo, useState } from 'react';
import { useAlerts } from './hooks/useAlerts.js';
import { api } from './lib/api.js';
import { SEVERITY } from './lib/format.js';
import StatusBand from './components/StatusBand.jsx';
import AlertList from './components/AlertList.jsx';
import RunCheckPanel from './components/RunCheckPanel.jsx';

export default function App() {
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('all');
  const [resolvingId, setResolvingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const { alerts, stats, loading, error, updatedAt, refresh } = useAlerts(status);

  const visible = useMemo(
    () =>
      alerts
        .filter((a) => severity === 'all' || a.severity === severity)
        .sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || new Date(b.last_seen_at) - new Date(a.last_seen_at)),
    [alerts, severity]
  );

  async function handleResolve(id) {
    setActionError(null);
    setResolvingId(id);
    try {
      await api.resolve(id);
      await refresh({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  const banner = error || actionError;

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#0B6F6A" />
            <path d="M3 15h5l3-7 4 12 3-5h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-xl font-bold">ApiWatch</span>
          <span className="ml-auto text-sm text-soft">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ''}</span>
          <button type="button" onClick={() => refresh()} className="rounded-md border border-line px-3 py-1.5 text-base font-bold hover:bg-brand-tint">
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {banner && (
          <p role="alert" className="mt-6 rounded-md border border-sev-critical bg-tint-critical p-3 text-base font-bold text-sev-critical">
            {banner}
          </p>
        )}

        <StatusBand stats={stats} loading={loading} />

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <AlertList
            alerts={visible}
            status={status}
            onStatus={setStatus}
            severity={severity}
            onSeverity={setSeverity}
            loading={loading}
            onResolve={handleResolve}
            resolvingId={resolvingId}
          />
          <RunCheckPanel onDone={() => refresh({ silent: true })} />
        </div>
      </main>
    </div>
  );
}
