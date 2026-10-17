import { useState } from 'react';
import { api } from '../lib/api.js';
import { plural } from '../lib/format.js';

const EXAMPLE = JSON.stringify(
  [
    { api_name: 'PatientDataAPI', response_time_ms: 1200, status_code: 200, records_returned: 50 },
    { api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 },
  ],
  null,
  2
);

function Summary({ r }) {
  return (
    <div className="space-y-2 text-base">
      <p>
        Checked {r.checked} {plural(r.checked, 'API')}: <strong>{r.anomalies}</strong> {plural(r.anomalies, 'anomaly', 'anomalies')} found, {r.healthy} healthy.
      </p>
      <p className="text-soft">
        {r.newAlerts} new, {r.updatedAlerts} updated, {r.resolvedAlerts} resolved. Alert text: {r.aiGenerated} by AI, {r.ruleBased} rule-based.
      </p>
      {r.rejected?.length > 0 && (
        <div>
          <p className="font-bold text-sev-high">{r.rejected.length} {plural(r.rejected.length, 'item was', 'items were')} skipped:</p>
          <ul className="list-disc pl-5 text-soft">
            {r.rejected.map((x) => (
              <li key={x.index}>Item {x.index + 1}: {x.errors.join(', ')}</li>
            ))}
          </ul>
        </div>
      )}
      {r.failed?.length > 0 && <p className="font-bold text-sev-critical">{r.failed.length} could not be stored. See the backend log.</p>}
    </div>
  );
}

export default function RunCheckPanel({ onDone }) {
  const [text, setText] = useState(EXAMPLE);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run(kind) {
    setError(null);
    setResult(null);
    let records;
    if (kind === 'paste') {
      try {
        records = JSON.parse(text);
      } catch {
        setError('That is not valid JSON. Check for a missing comma, bracket, or quote.');
        return;
      }
    }
    setBusy(kind);
    try {
      if (kind === 'email') {
        const r = await api.emailReport();
        setResult({ email: r.sent ? 'Email report sent.' : r.reason });
      } else {
        const r = kind === 'sample' ? await api.runSample() : await api.runMonitor(records);
        setResult({ summary: r });
        onDone();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const btn = 'rounded-md px-4 py-2 text-base font-bold disabled:opacity-50';
  return (
    <section aria-label="Check API responses" className="rounded-lg border border-line bg-white p-5">
      <h2 className="font-display text-2xl font-semibold">Check API responses</h2>
      <p className="mt-1 text-base text-soft">Paste a JSON array of responses, or run the bundled sample file.</p>

      <label htmlFor="payload" className="mt-4 block text-base font-bold">API responses (JSON)</label>
      <textarea
        id="payload"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        className="mt-1 w-full rounded-md border border-line bg-paper p-3 font-sans text-sm leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => run('paste')} disabled={!!busy} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
          {busy === 'paste' ? 'Checking' : 'Check responses'}
        </button>
        <button type="button" onClick={() => run('sample')} disabled={!!busy} className={`${btn} border border-line hover:bg-brand-tint`}>
          {busy === 'sample' ? 'Running' : 'Run sample data'}
        </button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <button type="button" onClick={() => run('email')} disabled={!!busy} className={`${btn} border border-line hover:bg-brand-tint`}>
          {busy === 'email' ? 'Sending' : 'Email active alerts'}
        </button>
      </div>

      <div aria-live="polite" className="mt-4">
        {error && <p role="alert" className="text-base font-bold text-sev-critical">{error}</p>}
        {result?.summary && <Summary r={result.summary} />}
        {result?.email && <p className="text-base">{result.email}</p>}
      </div>
    </section>
  );
}
