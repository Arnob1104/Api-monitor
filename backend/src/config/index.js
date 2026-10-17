import 'dotenv/config';

const toNumber = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const toBool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

export const config = {
  port: toNumber(process.env.PORT, 5000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxBatchSize: toNumber(process.env.MAX_BATCH_SIZE, 1000),
  autoResolve: toBool(process.env.AUTO_RESOLVE, true),

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    timeoutMs: toNumber(process.env.GROQ_TIMEOUT_MS, 8000),
    concurrency: toNumber(process.env.GROQ_CONCURRENCY, 3),
  },

  thresholds: {
    responseTimeWarnMs: toNumber(process.env.RESPONSE_TIME_WARN_MS, 2000),
    responseTimeCriticalMs: toNumber(process.env.RESPONSE_TIME_CRITICAL_MS, 5000),
  },

  email: {
    enabled: toBool(process.env.EMAIL_ENABLED, false),
    host: process.env.SMTP_HOST,
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: (process.env.EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean),
    minSeverity: process.env.EMAIL_MIN_SEVERITY || 'high',
  },
};

export function assertRequiredConfig() {
  const missing = [];
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  }
}
