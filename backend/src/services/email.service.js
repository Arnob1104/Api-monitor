import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let transporter;

export function emailAvailable() {
  const e = config.email;
  return Boolean(e.enabled && e.host && e.user && e.pass && e.to.length);
}

function getTransporter() {
  if (!transporter) {
    const e = config.email;
    transporter = nodemailer.createTransport({
      host: e.host,
      port: e.port,
      secure: e.secure,
      auth: { user: e.user, pass: e.pass },
    });
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = { critical: '#B3261E', high: '#D9621A', medium: '#8A6A00', low: '#3B6E91' };

function buildHtml(alerts) {
  const rows = alerts
    .map(
      (a) => `<tr>
  <td style="padding:10px;border-bottom:1px solid #e2e8ea"><strong>${esc(a.api_name)}</strong></td>
  <td style="padding:10px;border-bottom:1px solid #e2e8ea;color:${COLORS[a.severity] || '#333'};font-weight:600">${esc(a.severity)}</td>
  <td style="padding:10px;border-bottom:1px solid #e2e8ea">${esc(a.message)}<br><span style="color:#667;font-size:12px">Status ${esc(a.status_code ?? 'n/a')}, ${esc(a.response_time_ms ?? 'n/a')} ms, ${esc(a.records_returned ?? 'n/a')} records</span></td>
</tr>`
    )
    .join('');
  return `<div style="font-family:Arial,sans-serif;color:#12252e">
<h2 style="margin:0 0 8px">ApiWatch anomaly report</h2>
<p style="margin:0 0 16px">${alerts.length} active ${alerts.length === 1 ? 'alert' : 'alerts'}.</p>
<table style="border-collapse:collapse;width:100%;max-width:720px"><thead><tr>
<th align="left" style="padding:10px;border-bottom:2px solid #12252e">API</th>
<th align="left" style="padding:10px;border-bottom:2px solid #12252e">Severity</th>
<th align="left" style="padding:10px;border-bottom:2px solid #12252e">Alert</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function buildText(alerts) {
  return alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.api_name}: ${a.message}`).join('\n');
}

export async function sendAlertReport(alerts, { subject } = {}) {
  if (!emailAvailable()) throw new Error('Email is not configured or is disabled');
  if (!alerts.length) return { sent: false, reason: 'no alerts' };
  const info = await getTransporter().sendMail({
    from: config.email.from,
    to: config.email.to,
    subject: subject || `ApiWatch: ${alerts.length} active ${alerts.length === 1 ? 'alert' : 'alerts'}`,
    text: buildText(alerts),
    html: buildHtml(alerts),
  });
  logger.info('Alert report emailed', { messageId: info.messageId, recipients: config.email.to.length, alerts: alerts.length });
  return { sent: true, messageId: info.messageId };
}
