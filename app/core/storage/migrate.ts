import Database from 'better-sqlite3';

type TableColumn = { name: string };

function columnNames(db: Database.Database, table: string): Set<string> {
  return new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((column: unknown) => (column as TableColumn).name)
  );
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  if (columnNames(db, table).has(column)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

export function ensureStorageContract(db: Database.Database) {
  db.exec('PRAGMA foreign_keys = ON');

  const feedColumns = columnNames(db, 'feeds');
  if (!feedColumns.has('last_error')) {
    db.prepare(`ALTER TABLE feeds ADD COLUMN last_error TEXT`).run();
  }
  if (!feedColumns.has('last_fetched_at')) {
    db.prepare(`ALTER TABLE feeds ADD COLUMN last_fetched_at TEXT`).run();
  }
  if (!feedColumns.has('is_fetching')) {
    db.prepare(`ALTER TABLE feeds ADD COLUMN is_fetching INTEGER NOT NULL DEFAULT 0`).run();
  }
  if (!feedColumns.has('is_muted')) {
    db.prepare(`ALTER TABLE feeds ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0`).run();
  }

  const refreshedFeedColumns = columnNames(db, 'feeds');
  if (refreshedFeedColumns.has('fetch_error')) {
    db.prepare(
      `UPDATE feeds
       SET last_error = fetch_error
       WHERE last_error IS NULL AND fetch_error IS NOT NULL`
    ).run();
  }

  addColumnIfMissing(db, 'sections', 'key', 'TEXT');
  db.prepare(
    `UPDATE sections
     SET key = LOWER(REPLACE(name, ' ', '_'))
     WHERE key IS NULL OR TRIM(key) = ''`
  ).run();
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_key_unique ON sections(key)`).run();

  db.prepare(
    `INSERT INTO settings(key, value_json)
     VALUES
       ('layout', '{"panels":[]}'),
       ('show_seen_news', 'false'),
       ('theme_mode', '"light"')
     ON CONFLICT(key) DO NOTHING`
  ).run();
}

export const ensureFeedColumns = ensureStorageContract;