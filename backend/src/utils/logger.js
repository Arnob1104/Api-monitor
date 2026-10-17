import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const level = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const logDir = path.resolve(process.cwd(), 'logs');
let stream = null;
try {
  fs.mkdirSync(logDir, { recursive: true });
  stream = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });
  stream.on('error', () => { stream = null; });
} catch {
  stream = null; // console-only logging if the file cannot be opened
}

function write(lvl, message, meta) {
  if (LEVELS[lvl] > level) return;
  const time = new Date().toISOString();
  const line = JSON.stringify({ time, level: lvl, message, ...(meta ? { meta } : {}) });
  stream?.write(line + '\n');
  const out = `${time} ${lvl.toUpperCase().padEnd(5)} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  (lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log)(out);
}

export const logger = {
  error: (m, meta) => write('error', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  info: (m, meta) => write('info', m, meta),
  debug: (m, meta) => write('debug', m, meta),
};
