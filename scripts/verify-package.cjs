const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const asar = require('@electron/asar');

const root = path.resolve(__dirname, '..');
const releaseDirectory = path.join(root, 'release');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(directory, depth = 0) {
  if (!fs.existsSync(directory) || depth > 6) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(item, depth + 1));
    else if (entry.isFile()) results.push(item);
  }
  return results;
}

function findPackagedLayout() {
  const archives = walk(releaseDirectory).filter((file) => path.basename(file) === 'app.asar');
  assert(archives.length > 0, 'No unpacked packaged app found under release/. Run npm run pack first.');
  const expected = process.platform === 'win32' ? 'win-' : process.platform === 'darwin' ? '.app' : 'linux-';
  const appAsar = archives.find((file) => file.toLowerCase().includes(expected)) || archives[0];
  const resources = path.dirname(appAsar);
  let executable;
  if (process.platform === 'win32') executable = path.join(path.dirname(resources), 'READIT.exe');
  else if (process.platform === 'darwin') executable = path.join(path.dirname(resources), 'MacOS', 'READIT');
  else executable = path.join(path.dirname(resources), 'readit');
  return { appAsar, resources, executable };
}

function normalizeAsarEntry(entry) {
  return entry.replace(/^[/\\]+/, '').replace(/\\/g, '/');
}

function verifyStructure(layout) {
  assert(fs.existsSync(layout.executable), 'Packaged executable is missing: ' + layout.executable);
  const entries = asar.listPackage(layout.appAsar).map(normalizeAsarEntry);
  for (const file of ['package.json', 'dist/app/main/app.js', 'dist/app/preload/bridge.js', 'dist/app/renderer/index.html', 'dist/app/core/storage/db.js']) {
    assert(entries.includes(file), 'Packaged ASAR is missing ' + file);
  }
  const forbidden = [/^tests\//, /^data\//, /^coverage\//, /^docs\//, /^\.git\//, /^dist\/scripts\//, /\.map$/, /\.(?:[cm]?ts|tsx)$/];
  for (const entry of entries) assert(!forbidden.some((pattern) => pattern.test(entry)), 'Forbidden packaged entry: ' + entry);
  for (const file of ['config/csp.json', 'config/app.config.json']) {
    assert(fs.existsSync(path.join(layout.resources, file)), 'Packaged resource is missing ' + file);
  }
  const migrationDirectory = path.join(layout.resources, 'migrations');
  assert(fs.existsSync(migrationDirectory), 'Packaged migrations directory is missing: ' + migrationDirectory);
  const migrations = fs.readdirSync(migrationDirectory).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  assert(migrations.length > 0, 'No packaged migrations were found');

  const nativeDirectory = path.join(layout.resources, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'electron');
  const binding = path.join(nativeDirectory, 'better_sqlite3.node');
  const manifestPath = path.join(nativeDirectory, 'manifest.json');
  assert(fs.existsSync(binding), 'Packaged Electron SQLite binding is missing');
  assert(fs.existsSync(manifestPath), 'Packaged Electron SQLite manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
  assert(manifest.electronVersion === electronVersion, 'Packaged SQLite manifest targets the wrong Electron version');
  assert(manifest.arch === process.arch, 'Packaged SQLite manifest targets the wrong architecture');

  const resourceFiles = walk(layout.resources).filter((file) => !file.endsWith('app.asar'));
  assert(!resourceFiles.some((file) => /(?:^|[\\/])app\.db$/i.test(file)), 'A local app.db was packaged');
  assert(!resourceFiles.some((file) => /(?:^|[\\/])exports?(?:[\\/]|$)/i.test(file)), 'Local exports were packaged');
  return { entries: entries.length, migrations: migrations.length, nativeBinding: binding };
}

function runSmoke(layout) {
  const smokeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-package-smoke-'));
  try {
    const environment = { ...process.env, READIT_PACKAGE_SMOKE_DIR: smokeDirectory };
    delete environment.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(layout.executable, [], {
      env: environment,
      encoding: 'utf8',
      timeout: 45_000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    assert(result.status === 0, 'Packaged smoke process failed with exit code ' + result.status + ': ' + (result.stderr || result.stdout));
    const reportPath = path.join(smokeDirectory, 'package-smoke.json');
    assert(fs.existsSync(reportPath), 'Packaged app did not write its smoke report');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert(report.ok === true && report.packaged === true, 'Packaged app did not enter packaged runtime mode');
    assert(report.databaseExists === true && report.migrations > 0, 'Packaged SQLite initialization or migrations failed');
    assert(report.dataInsideResources === false, 'Packaged app attempted to write inside its resources directory');
    return report;
  } finally {
    fs.rmSync(smokeDirectory, { recursive: true, force: true });
  }
}

function main() {
  const layout = findPackagedLayout();
  const structure = verifyStructure(layout);
  const smoke = runSmoke(layout);
  console.log(JSON.stringify({ ok: true, executable: layout.executable, appAsar: layout.appAsar, structure, smoke }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { findPackagedLayout, verifyStructure, runSmoke };
