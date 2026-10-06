import type { App } from 'electron';
import { configureRuntimePaths, developmentRuntimePaths, packagedRuntimePaths } from '../core/runtime/paths';

export function configureElectronRuntimePaths(app: Pick<App, 'isPackaged' | 'getPath'>, resourcesPath = process.resourcesPath) {
  const paths = app.isPackaged
    ? packagedRuntimePaths({ resourcesPath, userDataPath: app.getPath('userData') })
    : developmentRuntimePaths(process.cwd());
  return configureRuntimePaths(paths);
}
