const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { fetchFeed } = require(path.join(root, 'dist', 'app', 'core', 'rss', 'fetch.js'));
const { parseFeed } = require(path.join(root, 'dist', 'app', 'core', 'rss', 'parser.js'));
const { normalizeFeedUrl } = require(path.join(root, 'dist', 'app', 'core', 'rss', 'url.js'));

function loadTargets(file) {
  if (!file) {
    const { SECTION_CONFIG } = require(path.join(root, 'dist', 'app', 'config', 'sections.js'));
    return SECTION_CONFIG.map((section) => ({
      key: section.key,
      name: section.name,
      feeds: section.feeds.map((feed) => ({ title: feed.title, url: feed.url })),
    }));
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed.sections.map((section) => ({ key: section.key, name: section.name, feeds: section.feeds }));
}

async function pool(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function verify(entry) {
  const sanitized = normalizeFeedUrl(entry.url);
  if (!sanitized.ok) {
    return { sectionKey: entry.sectionKey, title: entry.title, url: entry.url, result: `SANITIZE_REJECT (${sanitized.code}: ${sanitized.message})`, ok: false };
  }
  const res = await fetchFeed(entry.url, { timeoutMs: 12000 });
  if (res.status === 'error') {
    return { sectionKey: entry.sectionKey, title: entry.title, url: res.url, result: `FAIL (${res.error ? `${res.error.code}: ${res.error.message}` : 'unknown'})`, ok: false };
  }
  try {
    const parsed = parseFeed(res.body || '');
    const feedTitle = (parsed.feed.title || '').slice(0, 48);
    return { sectionKey: entry.sectionKey, title: entry.title, url: res.url, result: `OK (HTTP ${res.httpStatus}, ${parsed.items.length} items, "${feedTitle}")`, ok: true };
  } catch (err) {
    return { sectionKey: entry.sectionKey, title: entry.title, url: res.url, result: `NOT_A_FEED (HTTP ${res.httpStatus}, ${err.message})`, ok: false };
  }
}

async function main() {
  const fileArgIndex = process.argv.indexOf('--file');
  const file = fileArgIndex !== -1 ? process.argv[fileArgIndex + 1] : null;
  const sections = loadTargets(file);
  const entries = [];
  for (const section of sections) {
    for (const feed of section.feeds) entries.push({ ...feed, sectionKey: section.key });
  }
  console.log(`Verifying ${entries.length} feed URLs from ${file || 'dist catalog (compiled SECTION_CONFIG)'} ...`);

  const results = new Array(entries.length);
  await pool(entries, 10, async (entry, index) => {
    results[index] = await verify(entry);
    const r = results[index];
    console.log(`[${String(index + 1).padStart(entries.length.toString().length, ' ')}] ${r.sectionKey} | ${r.title} | ${r.result}`);
  });

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Summary: ${results.length - failed.length} OK, ${failed.length} failed of ${results.length}.`);
  if (failed.length > 0) {
    console.log('');
    console.log('Failed URLs:');
    for (const r of failed) console.log(`  ${r.sectionKey} | ${r.title} | ${r.url} | ${r.result}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack || err.message) : String(err));
  process.exitCode = 1;
});
