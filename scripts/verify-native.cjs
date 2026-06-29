const fs = require('fs');
const path = require('path');

const defaultRoot = path.resolve(__dirname, '..');

function verifyNative(root = defaultRoot, arch = process.arch) {
  const directory = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'electron');
  const binding = path.join(directory, 'better_sqlite3.node');
  const manifestPath = path.join(directory, 'manifest.json');
  if (!fs.existsSync(binding) || !fs.existsSync(manifestPath)) {
    throw new Error('Electron SQLite binding is missing.');
  }

  const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
  const nodeAbi = require(path.join(root, 'node_modules', '@electron', 'rebuild', 'node_modules', 'node-abi'));
  const abi = String(nodeAbi.getAbi(electronVersion, 'electron'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.electronVersion !== electronVersion || manifest.abi !== abi || manifest.arch !== arch) {
    throw new Error('Electron SQLite binding is stale for Electron ' + electronVersion + ', ABI ' + abi + ', ' + arch + '.');
  }
  return manifest;
}

if (require.main === module) {
  try {
    verifyNative();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Run: npm run rebuild:native');
    process.exitCode = 1;
  }
}

module.exports = { verifyNative };