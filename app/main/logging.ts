type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  try {
    // Keep output stable JSON for easy parsing
    const line = JSON.stringify({
      t: new Date().toISOString(),
      level,
      msg,
      ...(meta ? { meta } : {}),
    });
    console.log(line);
  } catch {
    // Fall back if meta is not serializable
    console.log(JSON.stringify({ t: new Date().toISOString(), level, msg }));
  }
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