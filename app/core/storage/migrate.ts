import Database from 'better-sqlite3';

export function ensureFeedColumns(db: Database.Database) {
  const cols = db
    .prepare(`PRAGMA table_info(feeds)`)
    .all()
    .map((c: any) => c.name);

  const add = (sql: string) => {
    try {
      db.prepare(sql).run();
    } catch {
      /* ignore – column probably exists */
    }
  };

  if (!cols.includes('last_fetched_at')) {
    add(`ALTER TABLE feeds ADD COLUMN last_fetched_at TEXT`);
  }

  if (!cols.includes('fetch_error')) {
    add(`ALTER TABLE feeds ADD COLUMN fetch_error TEXT`);
  }

  if (!cols.includes('is_fetching')) {
    add(`ALTER TABLE feeds ADD COLUMN is_fetching INTEGER DEFAULT 0`);
  }
}
