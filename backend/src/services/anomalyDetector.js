/**
 * Pure anomaly detection: no I/O, no dependencies, easy to unit test.
 *
 * Input record:  { api_name, response_time_ms, status_code, records_returned }
 * Output:        { anomalies: [{ type, severity, detail }], severity, anomalyTypes, anomalyKey }
 */

export const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

export const DEFAULT_THRESHOLDS = {
  responseTimeWarnMs: 2000,
  responseTimeCriticalMs: 5000,
};

const rank = (severity) => SEVERITY_ORDER.indexOf(severity);
const maxSeverity = (list) => list.reduce((a, b) => (rank(b) > rank(a) ? b : a), 'low');

/** A field may be absent (null) but, if present, must be numeric. */
function toNumberOrNull(value, field, errors, { integer = false } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) {
    errors.push(`${field} must be a number`);
    return null;
  }
  if (integer && !Number.isInteger(n)) {
    errors.push(`${field} must be a whole number`);
    return null;
  }
  return n;
}

/** Validate and normalise one raw item. Unusable items are rejected, not crashed on. */
export function validateRecord(raw) {
  const errors = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['each item must be a JSON object'] };
  }
  const apiName = typeof raw.api_name === 'string' ? raw.api_name.trim() : '';
  if (!apiName) errors.push('api_name is required');

  const record = {
    api_name: apiName,
    response_time_ms: toNumberOrNull(raw.response_time_ms, 'response_time_ms', errors),
    status_code: toNumberOrNull(raw.status_code, 'status_code', errors, { integer: true }),
    records_returned: toNumberOrNull(raw.records_returned, 'records_returned', errors, { integer: true }),
  };
  return errors.length ? { valid: false, errors } : { valid: true, record };
}

export function detectAnomalies(record, thresholds = DEFAULT_THRESHOLDS) {
  const { response_time_ms: rt, status_code: status, records_returned: records } = record;
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const anomalies = [];
  const missing = [];

  // 1. HTTP status
  const isFailure = status !== null && status >= 400;
  if (status === null) {
    missing.push('status_code');
  } else if (status >= 500) {
    anomalies.push({ type: 'SERVER_ERROR', severity: 'critical', detail: `Server error, HTTP ${status}` });
  } else if (status >= 400) {
    anomalies.push({ type: 'CLIENT_ERROR', severity: 'high', detail: `Request rejected, HTTP ${status}` });
  } else if (status < 200 || status >= 300) {
    anomalies.push({ type: 'UNEXPECTED_STATUS', severity: 'low', detail: `Unexpected HTTP ${status}` });
  }

  // 2. Response time
  if (rt === null) {
    missing.push('response_time_ms');
  } else if (rt < 0) {
    anomalies.push({ type: 'INCONSISTENT_DATA', severity: 'medium', detail: `Negative response time (${rt} ms)` });
  } else if (rt >= t.responseTimeCriticalMs) {
    anomalies.push({ type: 'HIGH_RESPONSE_TIME', severity: 'high', detail: `Response took ${rt} ms (critical threshold ${t.responseTimeCriticalMs} ms)` });
  } else if (rt >= t.responseTimeWarnMs) {
    anomalies.push({ type: 'HIGH_RESPONSE_TIME', severity: 'medium', detail: `Response took ${rt} ms (warning threshold ${t.responseTimeWarnMs} ms)` });
  }

  // 3. Returned data
  if (records === null) {
    missing.push('records_returned');
  } else if (records < 0) {
    anomalies.push({ type: 'INCONSISTENT_DATA', severity: 'high', detail: `Negative record count (${records})` });
  } else if (records === 0 && status !== 204) {
    // Empty data on a "successful" call is a data problem; after a failed call it is a side effect.
    const succeeded = status !== null && status >= 200 && status < 300;
    anomalies.push({
      type: 'ZERO_RECORDS',
      severity: succeeded ? 'high' : 'medium',
      detail: succeeded ? 'Request succeeded but returned 0 records' : 'Returned 0 records',
    });
  } else if (isFailure && records > 0) {
    anomalies.push({ type: 'INCONSISTENT_DATA', severity: 'medium', detail: `HTTP ${status} but ${records} records were returned` });
  }

  if (missing.length) {
    anomalies.push({ type: 'MISSING_DATA', severity: 'medium', detail: `Missing fields: ${missing.join(', ')}` });
  }

  const anomalyTypes = [...new Set(anomalies.map((a) => a.type))].sort();
  return {
    anomalies,
    severity: anomalies.length ? maxSeverity(anomalies.map((a) => a.severity)) : null,
    anomalyTypes,
    anomalyKey: anomalyTypes.join('+'),
  };
}

export function meetsSeverity(severity, minimum) {
  return rank(severity) >= rank(minimum);
}
