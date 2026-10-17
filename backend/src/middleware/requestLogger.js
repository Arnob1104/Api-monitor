import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const log = req.originalUrl.startsWith('/health') ? logger.debug : logger.info;
    log(`${req.method} ${req.originalUrl} ${res.statusCode}`, { ms: Date.now() - start });
  });
  next();
}
