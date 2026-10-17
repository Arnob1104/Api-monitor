import { getSupabase } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const TABLE = 'alerts';

function dbFail(error, action) {
  logger.error(`Database error while ${action}`, { code: error.code, message: error.message });
  throw new AppError(502, `Database error while ${action}`);
}

/**
 * Insert a new active alert, or bump the existing active alert for the same API and issue.
 * Returns { alert, created }.
 */
export async function upsertActiveAlert(a) {
  const db = getSupabase();
  const fields = {
    severity: a.severity,
    message: a.message,
    ai_generated: a.aiGenerated,
    status_code: a.record.status_code,
    response_time_ms: a.record.response_time_ms,
    records_returned: a.record.records_returned,
    details: a.anomalies,
  };

  // Two attempts: a concurrent insert can win the unique index, then we update instead.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: existing, error: findError } = await db
      .from(TABLE)
      .select('id, occurrence_count')
      .eq('api_name', a.record.api_name)
      .eq('anomaly_key', a.anomalyKey)
      .eq('status', 'active')
      .maybeSingle();
    if (findError) dbFail(findError, 'looking up existing alert');

    if (existing) {
      const { data, error } = await db
        .from(TABLE)
        .update({ ...fields, occurrence_count: existing.occurrence_count + 1, last_seen_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) dbFail(error, 'updating alert');
      return { alert: data, created: false };
    }

    const { data, error } = await db
      .from(TABLE)
      .insert({ api_name: a.record.api_name, anomaly_types: a.anomalyTypes, anomaly_key: a.anomalyKey, ...fields })
      .select()
      .single();
    if (!error) return { alert: data, created: true };
    if (error.code !== '23505') dbFail(error, 'saving alert');
  }
  throw new AppError(409, 'Could not save alert because of a concurrent update. Try again.');
}

/** Resolve an API's active alerts that no longer match its current state. */
export async function resolveStaleForApi(apiName, currentKey) {
  let query = getSupabase()
    .from(TABLE)
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('api_name', apiName)
    .eq('status', 'active');
  if (currentKey) query = query.neq('anomaly_key', currentKey);
  const { data, error } = await query.select('id');
  if (error) dbFail(error, 'resolving stale alerts');
  return data.length;
}

export async function listAlerts({ status = 'active', severity, apiName, limit = 100, offset = 0 } = {}) {
  let query = getSupabase()
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('last_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status !== 'all') query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);
  if (apiName) query = query.eq('api_name', apiName);
  const { data, error, count } = await query;
  if (error) dbFail(error, 'fetching alerts');
  return { alerts: data, total: count ?? data.length };
}

export async function getActiveStats() {
  const { data, error } = await getSupabase().from(TABLE).select('severity, api_name').eq('status', 'active').limit(5000);
  if (error) dbFail(error, 'fetching alert stats');
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of data) bySeverity[row.severity] += 1;
  return { active: data.length, bySeverity, affectedApis: new Set(data.map((r) => r.api_name)).size };
}

export async function resolveAlertById(id) {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .maybeSingle();
  if (error) dbFail(error, 'resolving alert');
  if (!data) throw new AppError(404, 'Active alert not found. It may already be resolved.');
  return data;
}
