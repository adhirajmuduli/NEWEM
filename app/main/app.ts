// Main process bootstrap: lifecycle, IPC, window creation, scheduler start
declare const require: any;

import { registerIpcHandlers } from './ipc';
import { scheduler } from './scheduler';
import { createMainWindow } from './windows';
import { logger, withModule } from './logging';

const electron = (() => {
  try {
    return require('electron');
  } catch {
    return null;
  }
})();

const app: any = electron?.app;
const ipcMain: any = electron?.ipcMain;
const BrowserWindow: any = electron?.BrowserWindow;

const log = withModule('app');

let mainWindow: any | null = null;

function setupSingleInstanceLock() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    log.warn('second_instance_quit');
    app.quit();
    return false;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  return true;
}

function onReady() {
  try {
    // Register IPC before creating windows
    if (!ipcMain) throw new Error('ipcMain unavailable');
    registerIpcHandlers(ipcMain);
    log.info('ipc_registered');

    // Start scheduler
    scheduler.start();
    log.info('scheduler_started');

    // Create window
    mainWindow = createMainWindow();
    log.info('window_created');

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (e) {
    log.error('startup_error', { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

if (!app) {
  // Allow TypeScript build without Electron at compile-time
  logger.warn('electron_app_unavailable_at_build_time');
} else {
  if (setupSingleInstanceLock()) {
    app.whenReady().then(onReady).catch((e: unknown) => {
      log.error('when_ready_error', { error: e instanceof Error ? e.message : String(e) });
    });

    app.on('before-quit', () => {
      try {
        scheduler.stop();
        log.info('scheduler_stopped');
      } catch (e) {
        log.error('scheduler_stop_error', { error: e instanceof Error ? e.message : String(e) });
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        log.info('window_recreated');
      }
    });
  }
}