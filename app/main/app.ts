// Main process bootstrap: lifecycle, IPC, database readiness, window, and scheduler.
declare const require: any;

import fs from 'fs';
import path from 'path';
import { closeDb, initDb } from '../core/storage/db';
import type { RuntimePaths } from '../core/runtime/paths';
import { registerIpcHandlers } from './ipc';
import { scheduler } from './scheduler';
import { createMainWindow } from './windows';
import { bootstrapApplication } from './bootstrap';
import { logger, withModule } from './logging';
import { configureElectronRuntimePaths } from './runtimePaths';

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
const dialog: any = electron?.dialog;
const log = withModule('app');

let mainWindow: any | null = null;
let removeSchedulerListener: (() => void) | null = null;
const packageSmokeDirectory = process.env.READIT_PACKAGE_SMOKE_DIR
  ? path.resolve(process.env.READIT_PACKAGE_SMOKE_DIR)
  : null;

if (app && packageSmokeDirectory) {
  app.setPath('userData', packageSmokeDirectory);
}

function setupSingleInstanceLock() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    log.warn('second_instance_quit');
    app.quit();
    return false;
  }
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  return true;
}

function createTrackedWindow() {
  const window = createMainWindow();
  log.info('window_created');
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  return window;
}

function showFatalStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  log.error('startup_error', { error: message });
  dialog?.showErrorBox?.('READIT could not start', message);
  app.quit();
}

function isWithin(base: string, target: string) {
  const relative = path.relative(base, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function runPackageSmoke(paths: RuntimePaths) {
  const db = initDb();
  const migrations = (db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number }).count;
  closeDb();
  const reportPath = path.join(paths.dataDirectory, 'package-smoke.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ok: true,
    packaged: paths.packaged,
    electronVersion: process.versions.electron,
    abi: process.versions.modules,
    migrations,
    dataDirectory: paths.dataDirectory,
    migrationsDirectory: paths.migrationsDirectory,
    cspConfigPath: paths.cspConfigPath,
    dataInsideResources: isWithin(process.resourcesPath, paths.dataDirectory),
    databaseExists: fs.existsSync(path.join(paths.dataDirectory, 'app.db')),
  }, null, 2), 'utf8');
  log.info('package_smoke_complete', { reportPath, migrations });
  app.quit();
}

function onReady() {
  const runtimePaths = configureElectronRuntimePaths(app);
  if (packageSmokeDirectory) {
    runPackageSmoke(runtimePaths);
    return;
  }
  removeSchedulerListener ??= scheduler.onSyncCompleted((event) => {
    for (const window of BrowserWindow?.getAllWindows?.() ?? []) {
      if (!window.isDestroyed()) window.webContents.send('sync:completed', event);
    }
  });
  mainWindow = bootstrapApplication({
    initDb: () => initDb(),
    registerIpc: () => {
      if (!ipcMain) throw new Error('ipcMain unavailable');
      registerIpcHandlers(ipcMain);
      log.info('ipc_registered');
    },
    createWindow: createTrackedWindow,
    startScheduler: () => {
      scheduler.start();
      log.info('scheduler_started');
    },
    showFatalError: (title, message) => dialog?.showErrorBox?.(title, message),
    quit: () => app.quit(),
    logError: (message, meta) => log.error(message, meta),
  });
}

if (!app) {
  logger.warn('electron_app_unavailable_at_build_time');
} else if (setupSingleInstanceLock()) {
  app.whenReady().then(onReady).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log.error('when_ready_error', { error: message });
    dialog?.showErrorBox?.('READIT could not start', message);
    app.quit();
  });

  app.on('before-quit', () => {
    scheduler.stop();
    removeSchedulerListener?.();
    removeSchedulerListener = null;
    log.info('scheduler_stopped');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!BrowserWindow || BrowserWindow.getAllWindows().length > 0) return;
    try {
      mainWindow = createTrackedWindow();
    } catch (error) {
      showFatalStartupError(error);
    }
  });
}
