export type WindowInput = {
  key?: string;
  type?: string;
  isAutoRepeat?: boolean;
};

export type FullscreenWindow = {
  isFullScreen(): boolean;
  setFullScreen(value: boolean): void;
  removeMenu(): void;
  webContents: {
    on(channel: 'before-input-event', listener: (event: { preventDefault(): void }, input: WindowInput) => void): void;
  };
};

export function installWindowChrome(window: FullscreenWindow) {
  window.removeMenu();
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11' || input.isAutoRepeat) return;
    event.preventDefault();
    window.setFullScreen(!window.isFullScreen());
  });
}