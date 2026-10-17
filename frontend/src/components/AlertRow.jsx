import { useState } from 'react';
import SeverityBadge from './SeverityBadge.jsx';
import { SEVERITY, TYPE_LABELS, timeAgo, formatDate, plural } from '../lib/format.js';

function Metric({ label, value, bad }) {
  return (
    <div>
      <dt className="text-sm text-soft">{label}</dt>
      <dd className={`font-bold ${bad ? 'text-sev-critical' : ''}`}>{value}</dd>
    </div>
  );
}

export default function AlertRow({ alert, onResolve, resolving }) {
  const [open, setOpen] = useState(false);
  const resolved = alert.status === 'resolved';
  const { status_code: code, response_time_ms: rt, records_returned: records } = alert;

  return (
    <li className="relative border-b border-line last:border-b-0">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${resolved ? 'bg-line' : SEVERITY[alert.severity].edge}`} aria-hidden="true" />
      <div className={`py-5 pl-6 pr-4 sm:pr-6 ${resolved ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-display text-xl font-semibold">{alert.api_name}</h3>
          <SeverityBadge severity={alert.severity} />
          {resolved && <span className="rounded bg-brand-tint px-2 py-0.5 text-sm font-bold text-brand-dark">Resolved</span>}
          <span className="ml-auto text-sm text-soft" title={formatDate(alert.last_seen_at)}>
            Last seen {timeAgo(alert.last_seen_at)}
          </span>
        </div>

        <p className="mt-2 max-w-prose text-lg leading-snug">{alert.message}</p>

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <Metric label="Status" value={code ?? 'Missing'} bad={code >= 500} />
          <Metric label="Response time" value={rt == null ? 'Missing' : `${Number(rt).toLocaleString()} ms`} />
          <Metric label="Records" value={records == null ? 'Missing' : Number(records).toLocaleString()} bad={records === 0} />
          <Metric label="Seen" value={`${alert.occurrence_count} ${plural(alert.occurrence_count, 'time')}`} />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {alert.anomaly_types.map((t) => (
            <span key={t} className="rounded border border-line bg-white px-2 py-0.5 text-sm text-soft">
              {TYPE_LABELS[t] || t}
            </span>
          ))}
          <span className="ml-auto text-sm text-soft">{alert.ai_generated ? 'Written by AI' : 'Rule-based message'}</span>
        </div>

        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-base font-bold text-brand underline underline-offset-4 hover:text-brand-dark">
            {open ? 'Hide details' : 'Show details'}
          </button>
          {!resolved && (
            <button
              type="button"
              onClick={() => onResolve(alert.id)}
              disabled={resolving}
              className="text-base font-bold text-ink underline underline-offset-4 hover:text-brand-dark disabled:opacity-50"
            >
              {resolving ? 'Resolving' : 'Resolve'}
            </button>
          )}
        </div>

        {open && (
          <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5 text-base text-soft">
            {(alert.details || []).map((d, i) => (
              <li key={i}>{d.detail}</li>
            ))}
            <li>First seen {formatDate(alert.first_seen_at)}</li>
          </ul>
        )}
      </div>
    </li>
  );
}
