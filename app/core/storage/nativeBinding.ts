import fs from 'fs';
import path from 'path';

export type NativeBindingManifest = {
  electronVersion: string;
  abi: string;
  arch: string;
  betterSqliteVersion: string;
};

export function electronBindingPaths(root = process.cwd()) {
  const directory = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'electron');
  return {
    binding: path.join(directory, 'better_sqlite3.node'),
    manifest: path.join(directory, 'manifest.json'),
  };
}

export function resolveElectronNativeBinding(
  root = process.cwd(),
  versions: NodeJS.ProcessVersions = process.versions,
  arch = process.arch
) {
  if (!versions.electron) return undefined;
  const paths = electronBindingPaths(root);
  if (!fs.existsSync(paths.binding) || !fs.existsSync(paths.manifest)) {
    throw new Error('Electron SQLite binding is missing. Run npm run rebuild:native.');
  }

  let manifest: NativeBindingManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8')) as NativeBindingManifest;
  } catch {
    throw new Error('Electron SQLite binding manifest is invalid. Run npm run rebuild:native.');
  }

  if (manifest.electronVersion !== versions.electron || manifest.abi !== versions.modules || manifest.arch !== arch) {
    throw new Error(
      'Electron SQLite binding is stale (expected Electron ' + versions.electron +
      ', ABI ' + versions.modules + ', ' + arch + '). Run npm run rebuild:native.'
    );
  }
  return paths.binding;
}