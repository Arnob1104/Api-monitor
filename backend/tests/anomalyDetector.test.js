import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies, validateRecord, meetsSeverity } from '../src/services/anomalyDetector.js';

const check = (raw) => {
  const v = validateRecord(raw);
  assert.ok(v.valid, v.errors?.join(', '));
  return detectAnomalies(v.record);
};

test('healthy response produces no anomalies', () => {
  const r = check({ api_name: 'PatientDataAPI', response_time_ms: 1200, status_code: 200, records_returned: 50 });
  assert.equal(r.anomalies.length, 0);
  assert.equal(r.severity, null);
});

test('brief example: 500 + 5500 ms + 0 records', () => {
  const r = check({ api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 });
  assert.deepEqual(r.anomalyTypes, ['HIGH_RESPONSE_TIME', 'SERVER_ERROR', 'ZERO_RECORDS']);
  assert.equal(r.severity, 'critical');
  assert.equal(r.anomalyKey, 'HIGH_RESPONSE_TIME+SERVER_ERROR+ZERO_RECORDS');
});

test('warning-level latency is medium, critical-level latency is high', () => {
  assert.equal(check({ api_name: 'A', response_time_ms: 2600, status_code: 200, records_returned: 3 }).severity, 'medium');
  assert.equal(check({ api_name: 'A', response_time_ms: 5000, status_code: 200, records_returned: 3 }).severity, 'high');
});

test('200 with zero records is a high-severity data issue', () => {
  const r = check({ api_name: 'BillingAPI', response_time_ms: 480, status_code: 200, records_returned: 0 });
  assert.deepEqual(r.anomalyTypes, ['ZERO_RECORDS']);
  assert.equal(r.severity, 'high');
});

test('204 with zero records is fine', () => {
  assert.equal(check({ api_name: 'A', response_time_ms: 100, status_code: 204, records_returned: 0 }).anomalies.length, 0);
});

test('error status with records is flagged as inconsistent', () => {
  const r = check({ api_name: 'PharmacyAPI', response_time_ms: 900, status_code: 503, records_returned: 12 });
  assert.deepEqual(r.anomalyTypes, ['INCONSISTENT_DATA', 'SERVER_ERROR']);
});

test('missing records_returned becomes a MISSING_DATA anomaly, not a crash', () => {
  const r = check({ api_name: 'InsuranceAPI', response_time_ms: 750, status_code: 200 });
  assert.deepEqual(r.anomalyTypes, ['MISSING_DATA']);
  assert.match(r.anomalies[0].detail, /records_returned/);
});

test('4xx is high severity', () => {
  assert.equal(check({ api_name: 'A', response_time_ms: 100, status_code: 404, records_returned: 1 }).anomalies.find((a) => a.type === 'CLIENT_ERROR').severity, 'high');
});

test('validation rejects bad shapes', () => {
  assert.equal(validateRecord(null).valid, false);
  assert.equal(validateRecord({ response_time_ms: 10 }).valid, false);
  assert.equal(validateRecord({ api_name: 'A', status_code: 'abc' }).valid, false);
  assert.equal(validateRecord({ api_name: 'A', records_returned: 1.5 }).valid, false);
  assert.equal(validateRecord({ api_name: 'A', status_code: '200' }).record.status_code, 200);
});

test('meetsSeverity compares ranks', () => {
  assert.ok(meetsSeverity('critical', 'high'));
  assert.ok(!meetsSeverity('medium', 'high'));
});
