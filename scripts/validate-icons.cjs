const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
const icoPath = path.join(assets, 'sa-odia.ico');
const icnsPath = path.join(assets, 'sa-odia.icns');
const linuxDirectory = path.join(assets, 'icons');
const linuxIconPath = path.join(linuxDirectory, '256x256.png');
const pngMagic = Buffer.from('89504e470d0a1a0a', 'hex');

function pngDimensions(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngMagic)) throw new Error('Invalid PNG data');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function extractLinuxIcon() {
  const ico = fs.readFileSync(icoPath);
  if (ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error('assets/sa-odia.ico is invalid');
  const count = ico.readUInt16LE(4);
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    if (entry + 16 > ico.length) throw new Error('ICO directory is truncated');
    const width = ico[entry] || 256;
    const height = ico[entry + 1] || 256;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const image = ico.subarray(offset, offset + length);
    if (offset + length <= ico.length && image.subarray(0, 8).equals(pngMagic) && width === height && width >= 256) candidates.push({ width, image });
  }
  candidates.sort((left, right) => right.width - left.width);
  if (!candidates[0]) throw new Error('ICO does not contain a square PNG icon of at least 256x256');
  fs.mkdirSync(linuxDirectory, { recursive: true });
  fs.writeFileSync(linuxIconPath, candidates[0].image);
}

function validate() {
  if (!fs.existsSync(icoPath) || !fs.existsSync(icnsPath)) throw new Error('Required platform icons are missing');
  const icns = fs.readFileSync(icnsPath);
  if (icns.subarray(0, 4).toString('ascii') !== 'icns' || icns.readUInt32BE(4) !== icns.length) throw new Error('assets/sa-odia.icns is invalid');
  extractLinuxIcon();
  const dimensions = pngDimensions(fs.readFileSync(linuxIconPath));
  if (dimensions.width !== dimensions.height || dimensions.width < 256) throw new Error('Generated Linux icon is invalid');
  console.log('Validated platform icons and prepared Linux ' + dimensions.width + 'x' + dimensions.height + ' icon.');
}

if (require.main === module) {
  try { validate(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { validate, pngDimensions };
