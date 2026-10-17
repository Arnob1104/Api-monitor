import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { validateRecord, detectAnomalies, meetsSeverity } from './anomalyDetector.js';
import { generateAlertMessage } from './aiAlert.service.js';
import { upsertActiveAlert, resolveStaleForApi } from '../repositories/alert.repository.js';
import { emailAvailable, sendAlertReport } from './email.service.js';

const DB_CONCURRENCY = 5;

/**
 * Pipeline for a batch of API responses:
 *   validate -> detect anomalies -> generate alert text (LLM) -> store -> auto-resolve -> email
 */
export async function processBatch(rawRecords, { source = 'api' } = {}) {
  const started = Date.now();
  const rejected = [];
  const checked = [];

  // 1. Validate and detect (pure, fast)
  rawRecords.forEach((raw, index) => {
    const v = validateRecord(raw);
    if (!v.valid) {
      rejected.push({ index, api_name: raw?.api_name ?? null, errors: v.errors });
      return;
    }
    checked.push({ record: v.record, ...detectAnomalies(v.record, config.thresholds) });
  });
  const flagged = checked.filter((c) => c.anomalies.length > 0);

  // 2. Generate human-readable alerts, with a cap on parallel LLM calls
  const withMessages = await mapWithConcurrency(flagged, config.groq.concurrency, async (item) => ({
    ...item,
    ...(await generateAlertMessage(item.record, item.anomalies, item.severity)),
  }));

  // 3. Store. One failure must not lose the rest of the batch.
  const failed = [];
  const saved = (
    await mapWithConcurrency(withMessages, DB_CONCURRENCY, async (item) => {
      try {
        return await upsertActiveAlert(item);
      } catch (err) {
        failed.push({ api_name: item.record.api_name, error: err.message });
        return null;
      }
    })
  ).filter(Boolean);

  if (flagged.length > 0 && saved.length === 0) {
    throw new AppError(502, 'Anomalies were detected but none could be stored. Check the database connection.', { failed });
  }

  // 4. Auto-resolve alerts that no longer match each API's current state.
  //    Skipped for APIs that appear more than once in the batch, since the "current" state is ambiguous.
  let resolved = 0;
  if (config.autoResolve) {
    const occurrences = new Map();
    checked.forEach((c) => occurrences.set(c.record.api_name, (occurrences.get(c.record.api_name) ?? 0) + 1));
    const targets = checked.filter((c) => occurrences.get(c.record.api_name) === 1);
    const counts = await mapWithConcurrency(targets, DB_CONCURRENCY, async (c) => {
      try {
        return await resolveStaleForApi(c.record.api_name, c.anomalyKey || null);
      } catch (err) {
        logger.warn('Auto-resolve failed', { api: c.record.api_name, reason: err.message });
        return 0;
      }
    });
    resolved = counts.reduce((a, b) => a + b, 0);
  }

  // 5. Email new serious alerts without blocking the response
  const newAlerts = saved.filter((s) => s.created).map((s) => s.alert);
  const toEmail = newAlerts.filter((a) => meetsSeverity(a.severity, config.email.minSeverity));
  let email = 'skipped';
  if (toEmail.length && emailAvailable()) {
    email = 'queued';
    sendAlertReport(toEmail, { subject: `ApiWatch: ${toEmail.length} new ${toEmail.length === 1 ? 'alert' : 'alerts'}` }).catch((err) =>
      logger.error('Failed to send alert email', { reason: err.message })
    );
  }

  const summary = {
    source,
    received: rawRecords.length,
    checked: checked.length,
    healthy: checked.length - flagged.length,
    anomalies: flagged.length,
    newAlerts: newAlerts.length,
    updatedAlerts: saved.length - newAlerts.length,
    resolvedAlerts: resolved,
    aiGenerated: withMessages.filter((m) => m.aiGenerated).length,
    ruleBased: withMessages.filter((m) => !m.aiGenerated).length,
    email,
    rejected,
    failed,
    alerts: saved.map((s) => s.alert),
    durationMs: Date.now() - started,
  };
  logger.info('Batch processed', { ...summary, alerts: undefined });
  return summary;
}
