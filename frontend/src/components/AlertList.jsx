import AlertRow from './AlertRow.jsx';
import { SEVERITY, SEVERITY_KEYS } from '../lib/format.js';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line bg-white">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-base font-bold ${value === o.value ? 'bg-ink text-white' : 'text-soft hover:bg-brand-tint'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AlertList({ alerts, status, onStatus, severity, onSeverity, loading, onResolve, resolvingId }) {
  const severityOptions = [{ value: 'all', label: 'Any severity' }, ...SEVERITY_KEYS.map((k) => ({ value: k, label: SEVERITY[k].label }))];

  let empty = null;
  if (!alerts.length && !loading) {
    empty =
      severity !== 'all'
        ? `No ${severity} alerts match these filters.`
        : status === 'active'
        ? 'No active alerts. Every API checked so far looks healthy. Run a check to see new results.'
        : 'No alerts to show yet.';
  }

  return (
    <section aria-label="Alerts">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-display text-2xl font-semibold">Alerts</h2>
        <Segmented label="Filter by status" options={STATUSES} value={status} onChange={onStatus} />
        <Segmented label="Filter by severity" options={severityOptions} value={severity} onChange={onSeverity} />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white" aria-busy={loading}>
        {empty ? (
          <p className="p-8 text-lg text-soft">{empty}</p>
        ) : (
          <ul>
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} onResolve={onResolve} resolving={resolvingId === a.id} />
            ))}
          </ul>
        )}
        {loading && !alerts.length && <p className="p-8 text-lg text-soft">Loading alerts</p>}
      </div>
    </section>
  );
}
