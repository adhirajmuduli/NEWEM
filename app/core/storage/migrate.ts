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

export function normalizeStoredItemDates(db: Database.Database) {
  const marker = db.prepare(`SELECT value_json FROM settings WHERE key=?`).get('migration:item_dates_iso_v1') as
    | { value_json: string }
    | undefined;
  if (marker?.value_json === 'true') return 0;

  const rows = db.prepare(`SELECT id, published_at FROM items WHERE published_at IS NOT NULL`).all() as Array<{
    id: number;
    published_at: string;
  }>;
  const update = db.prepare(`UPDATE items SET published_at=? WHERE id=?`);
  return db.transaction(() => {
    let changed = 0;
    for (const row of rows) {
      const timestamp = Date.parse(row.published_at);
      if (Number.isNaN(timestamp)) continue;
      const normalized = new Date(timestamp).toISOString();
      if (normalized === row.published_at) continue;
      changed += update.run(normalized, row.id).changes;
    }
    db.prepare(
      `INSERT INTO settings(key, value_json) VALUES (?, 'true')
       ON CONFLICT(key) DO UPDATE SET value_json='true'`
    ).run('migration:item_dates_iso_v1');
    return changed;
  })();
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

  db.prepare(`UPDATE feeds SET is_fetching = 0 WHERE COALESCE(is_fetching, 0) != 0`).run();

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
  normalizeStoredItemDates(db);
}

export const ensureFeedColumns = ensureStorageContract;
