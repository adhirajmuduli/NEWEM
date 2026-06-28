import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { electronBindingPaths, resolveElectronNativeBinding } from '../../app/core/storage/nativeBinding';

const requireFromTest = createRequire(import.meta.url);
const { preserveFileDuring } = requireFromTest('../../scripts/prepare-native.cjs') as {
  preserveFileDuring(file: string, backup: string, operation: () => void): void;
};
const { verifyNative } = requireFromTest('../../scripts/verify-native.cjs') as {
  verifyNative(root?: string, arch?: string): { electronVersion: string; abi: string };
};
const roots: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-native-'));
  roots.push(root);
  return root;
}

function versions(electron?: string, modules = '127') {
  return { electron, modules } as NodeJS.ProcessVersions;
}

afterEach(() => {
  while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('native SQLite binding selection', () => {
  it('uses the standard binding for Node and a verified separate binding for Electron', () => {
    const root = tempRoot();
    expect(resolveElectronNativeBinding(root, versions())).toBeUndefined();

    const paths = electronBindingPaths(root);
    fs.mkdirSync(path.dirname(paths.binding), { recursive: true });
    fs.writeFileSync(paths.binding, 'electron-binding');
    fs.writeFileSync(paths.manifest, JSON.stringify({
      electronVersion: '42.5.0',
      abi: '146',
      arch: process.arch,
      betterSqliteVersion: '12.11.1',
    }));

    expect(resolveElectronNativeBinding(root, versions('42.5.0', '146'))).toBe(paths.binding);
    expect(() => resolveElectronNativeBinding(root, versions('42.5.0', '145'))).toThrow(/stale/);
  });

  it('verifies the prepared checkout without spawning a subprocess', () => {
    expect(verifyNative(process.cwd())).toMatchObject({ electronVersion: '42.5.0', abi: '146' });
  });

  it('restores the Node binding even when the rebuild operation fails', () => {
    const root = tempRoot();
    const binding = path.join(root, 'better_sqlite3.node');
    const backup = path.join(root, 'backup.node');
    fs.writeFileSync(binding, 'node-abi-127');

    expect(() => preserveFileDuring(binding, backup, () => {
      fs.writeFileSync(binding, 'electron-abi-146');
      throw new Error('rebuild failed');
    })).toThrow('rebuild failed');

    expect(fs.readFileSync(binding, 'utf8')).toBe('node-abi-127');
    expect(fs.existsSync(backup)).toBe(false);
  });
});