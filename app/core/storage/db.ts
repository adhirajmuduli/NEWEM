import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { syncSectionsFromConfig } from './sectionsSync';
import { ensureFeedColumns } from './migrate';

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

function applyMigrations(db: Database.Database) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL)'
  );
  const applied = new Set<string>(
    db.prepare('SELECT name FROM schema_migrations ORDER BY id').all().map((r: any) => r.name)
  );
  const files = ['001_init.sql', '002_indexes.sql', '003_fetch_log.sql', '004_sections_key.sql', '005_item_state.sql'];
  db.transaction(() => {
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = readMigration(f);
      db.exec(sql);
      db
        .prepare(
          "INSERT INTO schema_migrations(name, applied_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
        )
        .run(f);
    }
  })();
}

export function initDb(dbPath?: string) {
  if (dbInstance) return dbInstance;
  const base = dbPath || path.join(process.cwd(), 'data');
  ensureDir(base);
  const file = path.join(base, 'app.db');
  const db = new Database(file);
  applyMigrations(db);

  ensureFeedColumns(db);
  
  // NEW: configuration-driven sections/feeds sync (idempotent)
  syncSectionsFromConfig(db);

  dbInstance = db;
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) return initDb();
  return dbInstance;
}

export {};