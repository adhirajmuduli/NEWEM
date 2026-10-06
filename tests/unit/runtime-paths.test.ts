import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { configureRuntimePaths, developmentRuntimePaths, getRuntimePaths, packagedRuntimePaths, resetRuntimePathsForTests } from '../../app/core/runtime/paths';

afterEach(() => resetRuntimePathsForTests());

describe('runtime path contract', () => {
  it('preserves repository-relative development data and immutable paths', () => {
    const paths = developmentRuntimePaths(path.resolve('C:/workspace/readit'));
    expect(paths.packaged).toBe(false);
    expect(paths.dataDirectory).toBe(path.resolve('C:/workspace/readit/data'));
    expect(paths.cspConfigPath).toBe(path.resolve('C:/workspace/readit/config/csp.json'));
    expect(paths.nativeModuleRoot).toBe(path.resolve('C:/workspace/readit'));
  });

  it('separates packaged mutable data from immutable resources', () => {
    const resourcesPath = path.resolve('C:/Program Files/READIT/resources');
    const userDataPath = path.resolve('C:/Users/test/AppData/Roaming/READIT');
    const paths = packagedRuntimePaths({ resourcesPath, userDataPath });
    expect(paths).toMatchObject({
      packaged: true,
      dataDirectory: userDataPath,
      exportDirectory: path.join(userDataPath, 'exports'),
      migrationsDirectory: path.join(resourcesPath, 'migrations'),
      cspConfigPath: path.join(resourcesPath, 'config', 'csp.json'),
      nativeModuleRoot: path.join(resourcesPath, 'app.asar.unpacked'),
    });
    expect(path.relative(resourcesPath, paths.dataDirectory)).toMatch(/^\.\./);
  });

  it('exposes an explicitly configured process-wide contract', () => {
    const paths = packagedRuntimePaths({ resourcesPath: '/opt/readit/resources', userDataPath: '/home/test/.config/READIT' });
    configureRuntimePaths(paths);
    expect(getRuntimePaths()).toEqual(paths);
  });
});
