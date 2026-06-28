import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getRecentLogs } from './logging';

function exportDirectory(baseDirectory?: string) {
  const directory = baseDirectory || path.join(process.cwd(), 'data', 'exports');
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function exportDatabaseBackup(db: Database.Database, baseDirectory?: string) {
  const filePath = path.join(exportDirectory(baseDirectory), 'readit-backup-' + timestamp() + '.db');
  await db.backup(filePath);
  return filePath;
}

export function exportDiagnostics(db: Database.Database, baseDirectory?: string) {
  const filePath = path.join(exportDirectory(baseDirectory), 'readit-diagnostics-' + timestamp() + '.json');
  const migrations = db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY id').all();
  const recentFetches = db.prepare(
    'SELECT id, feed_id, status, http_status, fetched_at, duration_ms, message FROM fetch_log ORDER BY id DESC LIMIT 250'
  ).all();
  const counts = {
    sections: (db.prepare('SELECT COUNT(*) AS count FROM sections').get() as { count: number }).count,
    feeds: (db.prepare('SELECT COUNT(*) AS count FROM feeds').get() as { count: number }).count,
    items: (db.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number }).count,
  };
  const logs = getRecentLogs();
  fs.writeFileSync(filePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    runtime: { node: process.versions.node, electron: process.versions.electron || null },
    counts,
    migrations,
    recentFetches,
    logs,
  }, null, 2), 'utf8');
  return { filePath, entries: logs.length + recentFetches.length };
}