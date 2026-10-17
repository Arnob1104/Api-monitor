import { config, assertRequiredConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';

try {
  assertRequiredConfig();
} catch (err) {
  logger.error(err.message);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  logger.info(`ApiWatch backend listening on http://localhost:${config.port}`, {
    llm: config.groq.apiKey ? config.groq.model : 'rule-based fallback (no GROQ_API_KEY)',
    email: config.email.enabled ? 'enabled' : 'disabled',
  });
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason: String(reason) }));
