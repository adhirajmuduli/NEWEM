import path from 'path';

export type RuntimePaths = {
  packaged: boolean;
  dataDirectory: string;
  exportDirectory: string;
  migrationsDirectory: string;
  cspConfigPath: string;
  appConfigPath: string;
  nativeModuleRoot: string;
};

let configuredPaths: RuntimePaths | null = null;

export function developmentRuntimePaths(cwd = process.cwd()): RuntimePaths {
  return {
    packaged: false,
    dataDirectory: path.join(cwd, 'data'),
    exportDirectory: path.join(cwd, 'data', 'exports'),
    migrationsDirectory: path.resolve(__dirname, '..', 'storage', 'migrations'),
    cspConfigPath: path.join(cwd, 'config', 'csp.json'),
    appConfigPath: path.join(cwd, 'config', 'app.config.json'),
    nativeModuleRoot: cwd,
  };
}

export function packagedRuntimePaths(input: {
  resourcesPath: string;
  userDataPath: string;
}): RuntimePaths {
  return {
    packaged: true,
    dataDirectory: input.userDataPath,
    exportDirectory: path.join(input.userDataPath, 'exports'),
    migrationsDirectory: path.join(input.resourcesPath, 'migrations'),
    cspConfigPath: path.join(input.resourcesPath, 'config', 'csp.json'),
    appConfigPath: path.join(input.resourcesPath, 'config', 'app.config.json'),
    nativeModuleRoot: path.join(input.resourcesPath, 'app.asar.unpacked'),
  };
}

export function configureRuntimePaths(paths: RuntimePaths) {
  configuredPaths = Object.freeze({ ...paths });
  return configuredPaths;
}

export function getRuntimePaths() {
  return configuredPaths ?? developmentRuntimePaths();
}

export function resetRuntimePathsForTests() {
  configuredPaths = null;
}
