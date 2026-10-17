import { AppError } from '../utils/AppError.js';
import { listAlerts, getActiveStats, resolveAlertById } from '../repositories/alert.repository.js';
import { emailAvailable, sendAlertReport } from '../services/email.service.js';
import { SEVERITY_ORDER } from '../services/anomalyDetector.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /alerts?status=active|resolved|all&severity=&api_name=&limit=&offset= */
export async function getAlerts(req, res) {
  const { status = 'active', severity, api_name: apiName } = req.query;
  if (!['active', 'resolved', 'all'].includes(status)) throw new AppError(400, 'status must be active, resolved, or all.');
  if (severity && !SEVERITY_ORDER.includes(severity)) throw new AppError(400, `severity must be one of: ${SEVERITY_ORDER.join(', ')}.`);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const { alerts, total } = await listAlerts({ status, severity, apiName, limit, offset });
  res.json({ count: alerts.length, total, alerts });
}

export async function getStats(req, res) {
  res.json(await getActiveStats());
}

export async function resolveAlert(req, res) {
  if (!UUID.test(req.params.id)) throw new AppError(400, 'Alert id must be a valid UUID.');
  res.json(await resolveAlertById(req.params.id));
}

/** POST /alerts/report: email the current active alerts. */
export async function emailReport(req, res) {
  if (!emailAvailable()) {
    throw new AppError(503, 'Email is not set up. Set EMAIL_ENABLED=true and the SMTP_* and EMAIL_TO variables in backend/.env.');
  }
  const { alerts } = await listAlerts({ status: 'active', limit: 200 });
  if (!alerts.length) return res.json({ sent: false, reason: 'There are no active alerts to report.' });
  try {
    res.json(await sendAlertReport(alerts));
  } catch (err) {
    throw new AppError(502, `Could not send the email: ${err.message}`);
  }
}
