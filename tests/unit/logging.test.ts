import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecentLogs, logger } from '../../app/main/logging';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('main-process logging', () => {
  it('retains diagnostics without throwing when the output pipe is closed', () => {
    const brokenPipe = Object.assign(new Error('broken pipe'), { code: 'EPIPE' });
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw brokenPipe;
    });

    expect(() => logger.info('scheduler_tick', { feedId: 12 })).not.toThrow();
    expect(getRecentLogs(1)).toMatchObject([
      { level: 'info', msg: 'scheduler_tick', meta: { feedId: 12 } },
    ]);
  });
});