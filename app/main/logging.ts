type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogEntry = {
  t: string;
  level: LogLevel;
  msg: string;
  meta?: Record<string, unknown>;
};

const MAX_ENTRIES = 1000;
const entries: LogEntry[] = [];

function guardOutputStream(stream: NodeJS.WriteStream | undefined) {
  stream?.on('error', () => undefined);
}

guardOutputStream(process.stdout);
guardOutputStream(process.stderr);

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = { t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  try {
    console.log(JSON.stringify(entry));
  } catch {
    // Structured entries remain available through diagnostics when terminal output is unavailable.
  }
}

export function getRecentLogs(limit = 500) {
  return entries.slice(-Math.max(1, Math.min(MAX_ENTRIES, limit)));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
};

export function withModule(mod: string) {
  return {
    info: (msg: string, meta?: Record<string, unknown>) => logger.info(msg, { mod, ...(meta || {}) }),
    warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, { mod, ...(meta || {}) }),
    error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, { mod, ...(meta || {}) }),
    debug: (msg: string, meta?: Record<string, unknown>) => logger.debug(msg, { mod, ...(meta || {}) }),
  };
}