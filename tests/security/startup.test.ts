import { describe, expect, it, vi } from 'vitest';
import { bootstrapApplication } from '../../app/main/bootstrap';

describe('application bootstrap', () => {
  it('initializes the database before IPC, window, and scheduler', () => {
    const order: string[] = [];
    const window = { id: 1 };
    const result = bootstrapApplication({
      initDb: () => order.push('db'),
      registerIpc: () => order.push('ipc'),
      createWindow: () => { order.push('window'); return window; },
      startScheduler: () => order.push('scheduler'),
      showFatalError: vi.fn(),
      quit: vi.fn(),
      logError: vi.fn(),
    });
    expect(result).toBe(window);
    expect(order).toEqual(['db', 'ipc', 'window', 'scheduler']);
  });

  it('shows a fatal error and quits without opening a blank window when SQLite fails', () => {
    const createWindow = vi.fn();
    const showFatalError = vi.fn();
    const quit = vi.fn();
    const logError = vi.fn();

    const result = bootstrapApplication({
      initDb: () => { throw new Error('ABI mismatch'); },
      registerIpc: vi.fn(),
      createWindow,
      startScheduler: vi.fn(),
      showFatalError,
      quit,
      logError,
    });

    expect(result).toBeNull();
    expect(createWindow).not.toHaveBeenCalled();
    expect(showFatalError).toHaveBeenCalledWith('READIT could not start', 'ABI mismatch');
    expect(quit).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith('startup_error', { error: 'ABI mismatch' });
  });
});