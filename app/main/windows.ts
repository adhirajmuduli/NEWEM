import { BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { getSecureWebPreferences, isAllowedExternalUrl, loadCspConfig, serializeCsp } from './security';
import { withModule } from './logging';
import { installWindowChrome } from './windowChrome';

const log = withModule('window');

function installNavigationGuards(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [serializeCsp(loadCspConfig())],
      },
    });
  });
}

function installRendererDiagnostics(win: BrowserWindow) {
  win.webContents.on('did-finish-load', () => log.info('renderer_loaded'));
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    log.error('renderer_load_failed', { code, description, url, isMainFrame });
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error('preload_failed', { preloadPath, error: error.message });
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('renderer_gone', { reason: details.reason, exitCode: details.exitCode });
  });
  win.webContents.on('console-message', (...args: any[]) => {
    const level = typeof args[1] === 'number' ? args[1] : args[0]?.level;
    const message = typeof args[2] === 'string' ? args[2] : args[0]?.message;
    if (!message) return;
    const meta = { level, source: typeof args[4] === 'string' ? args[4] : args[0]?.sourceId };
    if (level === 3) log.error('renderer_console', { ...meta, message });
    else if (level === 2) log.warn('renderer_console', { ...meta, message });
    else log.info('renderer_console', { ...meta, message });
  });
}

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.resolve(__dirname, '..', 'preload', 'bridge.js');
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    fullscreen: true,
    autoHideMenuBar: true,
    title: '',
    backgroundColor: '#0f1218',
    webPreferences: getSecureWebPreferences(preloadPath),
  });

  installWindowChrome(win);
  win.on('page-title-updated', (event) => event.preventDefault());
  installNavigationGuards(win);
  installRendererDiagnostics(win);
  void win.loadFile(path.resolve(__dirname, '..', 'renderer', 'index.html')).catch((error) => {
    log.error('load_file_failed', { error: error instanceof Error ? error.message : String(error) });
  });
  return win;
}