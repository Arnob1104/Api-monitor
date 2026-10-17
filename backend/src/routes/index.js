import { Router } from 'express';
import { asyncHandler as h } from '../middleware/asyncHandler.js';
import { config } from '../config/index.js';
import { emailAvailable } from '../services/email.service.js';
import { monitor, monitorSample } from '../controllers/monitor.controller.js';
import { deepHealth } from '../controllers/health.controller.js';
import { getAlerts, getStats, resolveAlert, emailReport } from '../controllers/alerts.controller.js';

const router = Router();

router.get('/health', (req, res) =>
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), llm: config.groq.apiKey ? config.groq.model : 'rule-based fallback', email: emailAvailable() })
);

router.get('/health/deep', h(deepHealth)); // for UptimeRobot: also queries the database
router.post('/monitor', h(monitor));
router.post('/monitor/sample', h(monitorSample));

router.get('/alerts', h(getAlerts));
router.get('/alerts/stats', h(getStats)); // must stay above /alerts/:id routes
router.post('/alerts/report', h(emailReport));
router.patch('/alerts/:id/resolve', h(resolveAlert));

export default router;
