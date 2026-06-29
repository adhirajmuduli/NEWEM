import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { syncCatalogVersionIfNeeded } from './sectionsSync';
import { ensureStorageContract } from './migrate';
import { resolveElectronNativeBinding } from './nativeBinding';

let dbInstance: Database.Database | null = null;

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function migrationsDir() {
  return path.join(__dirname, 'migrations');
}

function readMigration(name: string) {
  const p = path.join(migrationsDir(), name);
  return fs.readFileSync(p, 'utf8');
}

export function listMigrationFiles(dir = migrationsDir()) {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));
}

export function applyMigrations(db: Database.Database) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL)'
  );
  const applied = new Set<string>(
    db.prepare('SELECT name FROM schema_migrations ORDER BY id').all().map((r: any) => r.name)
  );

  db.transaction(() => {
    for (const file of listMigrationFiles()) {
      if (applied.has(file)) continue;
      db.exec(readMigration(file));
      db
        .prepare(
          "INSERT INTO schema_migrations(name, applied_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
        )
        .run(file);
    }
  })();

  ensureStorageContract(db);
}

export function initDb(dbPath?: string) {
  if (dbInstance) return dbInstance;
  const base = dbPath || path.join(process.cwd(), 'data');
  ensureDir(base);
  const file = path.join(base, 'app.db');
  const nativeBinding = resolveElectronNativeBinding();
  const db = new Database(file, nativeBinding ? { nativeBinding } : undefined);
  applyMigrations(db);
  syncCatalogVersionIfNeeded(db);
  dbInstance = db;
  return dbInstance;
}

export function closeDb() {
  if (!dbInstance) return;
  dbInstance.close();
  dbInstance = null;
}

export function getDb() {
  if (!dbInstance) return initDb();
  return dbInstance;
}

export {};