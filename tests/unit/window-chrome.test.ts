import { describe, expect, it, vi } from 'vitest';
import { installWindowChrome } from '../../app/main/windowChrome';

describe('Electron window chrome', () => {
  it('removes the native menu and toggles fullscreen with F11', () => {
    let listener: ((event: { preventDefault(): void }, input: { key?: string; type?: string; isAutoRepeat?: boolean }) => void) | undefined;
    let fullscreen = true;
    const window = {
      removeMenu: vi.fn(),
      isFullScreen: vi.fn(() => fullscreen),
      setFullScreen: vi.fn((value: boolean) => { fullscreen = value; }),
      webContents: {
        on: vi.fn((_channel: 'before-input-event', next: typeof listener) => { listener = next; }),
      },
    };
    const event = { preventDefault: vi.fn() };

    installWindowChrome(window);
    listener?.(event, { key: 'F11', type: 'keyDown' });
    listener?.(event, { key: 'F11', type: 'keyUp' });

    expect(window.removeMenu).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.setFullScreen).toHaveBeenCalledWith(false);
  });
});