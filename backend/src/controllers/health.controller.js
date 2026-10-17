import { pingDatabase } from '../repositories/alert.repository.js';
import { logger } from '../utils/logger.js';

/**
 * GET /health/deep: for uptime monitors such as UptimeRobot.
 * 200 when the app and database both respond, 503 when the database cannot be reached.
 * Exposes no secrets or data.
 */
export async function deepHealth(req, res) {
  const started = Date.now();
  try {
    await pingDatabase();
    res.json({ status: 'ok', database: 'ok', responseMs: Date.now() - started });
  } catch (err) {
    logger.error('Deep health check failed', { reason: err.message });
    res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
}
