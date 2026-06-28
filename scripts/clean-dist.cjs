const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function removeDist() {
  if (!fs.existsSync(dist)) return;
  try {
    fs.rmSync(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    return;
  } catch (error) {
    const stale = path.join(root, `.dist-stale-${Date.now()}`);
    try {
      fs.renameSync(dist, stale);
      console.warn(`Could not remove locked dist immediately; moved it to ${path.basename(stale)}.`);
    } catch {
      throw error;
    }
  }
}

removeDist();
