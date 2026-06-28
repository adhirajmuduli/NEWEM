const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release');
const standardBinding = path.join(releaseDir, 'better_sqlite3.node');
const electronDir = path.join(releaseDir, 'electron');
const electronBinding = path.join(electronDir, 'better_sqlite3.node');
const manifestPath = path.join(electronDir, 'manifest.json');
const backup = path.join(os.tmpdir(), 'readit-node-binding-' + process.pid + '.node');

function preserveFileDuring(file, backupFile, operation) {
  fs.copyFileSync(file, backupFile);
  try {
    return operation();
  } finally {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, file);
      fs.rmSync(backupFile, { force: true });
    }
  }
}

function packageVersion(name) {
  return require(path.join(root, 'node_modules', name, 'package.json')).version;
}

function electronRuntime() {
  const electronVersion = packageVersion('electron');
  const abi = require(path.join(root, 'node_modules', '@electron', 'rebuild', 'node_modules', 'node-abi')).getAbi(electronVersion, 'electron');
  return { electron: electronVersion, modules: String(abi) };
}

function rebuildExecutable() {
  return path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild');
}

function main() {
  if (!fs.existsSync(standardBinding)) {
    throw new Error('Node better-sqlite3 binding is missing. Run npm rebuild better-sqlite3, then retry.');
  }
  const runtime = electronRuntime();
  preserveFileDuring(standardBinding, backup, () => {
    const result = spawnSync(
      rebuildExecutable(),
      ['-f', '-w', 'better-sqlite3', '--force-abi', runtime.modules],
      { cwd: root, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' }
    );
    if (result.status !== 0) throw new Error('electron-rebuild exited with code ' + result.status);
    if (!fs.existsSync(standardBinding)) throw new Error('electron-rebuild did not produce better_sqlite3.node');

    fs.mkdirSync(electronDir, { recursive: true });
    fs.copyFileSync(standardBinding, electronBinding);
    fs.writeFileSync(manifestPath, JSON.stringify({
      electronVersion: runtime.electron,
      abi: runtime.modules,
      arch: process.arch,
      betterSqliteVersion: packageVersion('better-sqlite3'),
    }, null, 2));
  });
  console.log('Prepared separate Node and Electron ' + runtime.electron + ' (ABI ' + runtime.modules + ') SQLite bindings.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { main, preserveFileDuring };