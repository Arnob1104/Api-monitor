import fs from 'node:fs/promises';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { processBatch } from '../services/monitor.service.js';

const SAMPLE_PATH = new URL('../../data/sample_api_responses.json', import.meta.url);

/** POST /monitor: body is a JSON array of API responses, or { "apis": [...] }. */
export async function monitor(req, res) {
  const records = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.apis) ? req.body.apis : null;
  if (!records) throw new AppError(400, 'Body must be a JSON array of API responses, or an object like { "apis": [...] }.');
  if (records.length === 0) throw new AppError(400, 'The batch is empty. Send at least one API response.');
  if (records.length > config.maxBatchSize) {
    throw new AppError(413, `Batch too large. The limit is ${config.maxBatchSize} items per request.`);
  }
  res.json(await processBatch(records, { source: 'api' }));
}

/** POST /monitor/sample: runs the bundled static JSON file through the same pipeline. */
export async function monitorSample(req, res) {
  const records = JSON.parse(await fs.readFile(SAMPLE_PATH, 'utf8'));
  res.json(await processBatch(records, { source: 'sample-file' }));
}
