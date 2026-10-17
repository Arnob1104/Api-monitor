import { SEVERITY, SEVERITY_KEYS, plural } from '../lib/format.js';

export default function StatusBand({ stats, loading }) {
  if (!stats) {
    return (
      <section aria-busy={loading} className="pt-10">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{loading ? 'Checking your APIs' : 'No data yet'}</h1>
        <div className="mt-6 h-4 rounded-full bg-line" />
      </section>
    );
  }

  const { active, affectedApis, bySeverity } = stats;
  const headline =
    active === 0
      ? 'All monitored APIs are healthy'
      : `${active} active ${plural(active, 'alert')} across ${affectedApis} ${plural(affectedApis, 'API')}`;
  const summary = SEVERITY_KEYS.map((k) => `${bySeverity[k]} ${k}`).join(', ');

  return (
    <section className="pt-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{headline}</h1>
      {bySeverity.critical > 0 && (
        <p className="mt-2 text-lg text-sev-critical">
          {bySeverity.critical} critical {plural(bySeverity.critical, 'alert needs', 'alerts need')} attention first.
        </p>
      )}

      <div role="img" aria-label={`Active alerts by severity: ${summary}`} className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-brand-tint">
        {active === 0 ? (
          <div className="h-full w-full bg-brand" />
        ) : (
          SEVERITY_KEYS.filter((k) => bySeverity[k] > 0).map((k) => (
            <div key={k} className={`h-full ${SEVERITY[k].bar}`} style={{ flexGrow: bySeverity[k] }} />
          ))
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base text-soft">
        {SEVERITY_KEYS.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm ${SEVERITY[k].bar}`} aria-hidden="true" />
            <span>
              <strong className="font-bold text-ink">{bySeverity[k]}</strong> {SEVERITY[k].label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
