export type BootstrapDependencies<TWindow> = {
  initDb(): unknown;
  registerIpc(): void;
  createWindow(): TWindow;
  startScheduler(): void;
  showFatalError(title: string, message: string): void;
  quit(): void;
  logError(message: string, meta: Record<string, unknown>): void;
};

export function bootstrapApplication<TWindow>(dependencies: BootstrapDependencies<TWindow>) {
  try {
    dependencies.initDb();
    dependencies.registerIpc();
    const window = dependencies.createWindow();
    dependencies.startScheduler();
    return window;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dependencies.logError('startup_error', { error: message });
    dependencies.showFatalError('READIT could not start', message);
    dependencies.quit();
    return null;
  }
}