import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ALERT_SYSTEM_PROMPT, buildAlertUserPrompt } from '../prompts/alertPrompt.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function joinClauses(list) {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** Deterministic alert text. Used when the LLM is unavailable, so alerts are never lost. */
export function buildFallbackMessage(record, anomalies) {
  const types = new Set(anomalies.map((a) => a.type));
  const { api_name: api, status_code: status, response_time_ms: rt } = record;
  const clauses = [];

  if (types.has('SERVER_ERROR')) clauses.push(`failed with status ${status}`);
  else if (types.has('CLIENT_ERROR')) clauses.push(`rejected the request with status ${status}`);
  else if (types.has('UNEXPECTED_STATUS')) clauses.push(`returned unexpected status ${status}`);
  if (types.has('HIGH_RESPONSE_TIME')) clauses.push(`responded slowly (${rt} ms)`);
  if (types.has('ZERO_RECORDS')) clauses.push('returned 0 records');
  if (types.has('INCONSISTENT_DATA')) {
    clauses.push(`sent inconsistent data (${anomalies.find((a) => a.type === 'INCONSISTENT_DATA').detail.toLowerCase()})`);
  }
  if (types.has('MISSING_DATA')) {
    clauses.push(`sent an incomplete response (${anomalies.find((a) => a.type === 'MISSING_DATA').detail.toLowerCase()})`);
  }

  let hint = 'Please investigate.';
  if (types.has('SERVER_ERROR')) hint = 'Possible outage or data issue.';
  else if (types.has('CLIENT_ERROR')) hint = 'Check credentials, request parameters, or recent API changes.';
  else if (types.has('ZERO_RECORDS')) hint = 'Possible upstream data issue.';
  else if (types.has('INCONSISTENT_DATA') || types.has('MISSING_DATA')) hint = 'The response format may have changed.';
  else if (types.has('HIGH_RESPONSE_TIME')) hint = 'Possible performance degradation.';

  return `${api} ${joinClauses(clauses)}. ${hint}`;
}

async function callGroq(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.groq.timeoutMs);
  try {
    const res = await fetch(config.groq.baseUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groq.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.groq.model, messages, temperature: 0.2, max_tokens: 150 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

function cleanMessage(text) {
  return String(text)
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

/**
 * Returns { message, aiGenerated }. Never throws: any LLM failure falls back to rule-based text.
 */
export async function generateAlertMessage(record, anomalies, severity) {
  const fallback = () => ({ message: buildFallbackMessage(record, anomalies), aiGenerated: false });
  if (!config.groq.apiKey) return fallback();

  const messages = [
    { role: 'system', content: ALERT_SYSTEM_PROMPT },
    { role: 'user', content: buildAlertUserPrompt(record, anomalies, severity) },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const message = cleanMessage(await callGroq(messages));
      if (message.length < 10 || message.length > 500) throw new Error('LLM returned an unusable message');
      return { message, aiGenerated: true };
    } catch (err) {
      const retryable = err.name === 'AbortError' || err.status === 429 || err.status >= 500;
      logger.warn('LLM alert generation failed', { api: record.api_name, attempt, reason: err.message });
      if (attempt === 2 || !retryable) break;
      await sleep(600 * attempt);
    }
  }
  return fallback();
}
