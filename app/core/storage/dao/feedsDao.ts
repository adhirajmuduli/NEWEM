import Database from 'better-sqlite3';

export interface Feed {
  id: number;
  url: string;
  title?: string | null;
  site_url?: string | null;
  etag?: string | null;
  last_modified?: string | null;
  last_fetched_at?: string | null;
  fetch_interval_minutes?: number | null;
  last_error?: string | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

export function createFeed(db: Database.Database, url: string) {
  const stmt = db.prepare(
    `INSERT INTO feeds(url) VALUES (?)
     ON CONFLICT(url) DO UPDATE SET url=excluded.url
     RETURNING *`
  );
  return stmt.get(url) as Feed;
}

export function bulkAddFeeds(db: Database.Database, urlsText: string) {
  const urls = urlsText
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  const stmt = db.prepare(
    `INSERT INTO feeds(url) VALUES (?)
     ON CONFLICT(url) DO NOTHING`
  );
  const tx = db.transaction((values: string[]) => {
    for (const u of values) stmt.run(u);
  });
  tx(urls);
  return urls.length;
}

export function listFeeds(db: Database.Database, opts?: { limit?: number; offset?: number }) {
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;
  const stmt = db.prepare(`SELECT * FROM feeds ORDER BY id LIMIT ? OFFSET ?`);
  return stmt.all(limit, offset) as Feed[];
}

export function getFeed(db: Database.Database, id: number) {
  const stmt = db.prepare(`SELECT * FROM feeds WHERE id=?`);
  return stmt.get(id) as Feed | undefined;
}

export function setEnabled(db: Database.Database, id: number, enabled: boolean) {
  const stmt = db.prepare(`UPDATE feeds SET is_enabled=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`);
  stmt.run(enabled ? 1 : 0, id);
}

export function updateMeta(db: Database.Database, id: number, meta: Partial<Pick<Feed, 'etag' | 'last_modified' | 'last_fetched_at' | 'last_error' | 'title' | 'site_url'>>) {
  const f = getFeed(db, id);
  if (!f) return;
  const newVals = {
    etag: meta.etag ?? f.etag,
    last_modified: meta.last_modified ?? f.last_modified,
    last_fetched_at: meta.last_fetched_at ?? f.last_fetched_at,
    last_error: meta.last_error ?? null,
    title: meta.title ?? f.title ?? null,
    site_url: meta.site_url ?? f.site_url ?? null,
  };
  const stmt = db.prepare(
    `UPDATE feeds SET etag=?, last_modified=?, last_fetched_at=?, last_error=?, title=?, site_url=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`
  );
  stmt.run(
    newVals.etag,
    newVals.last_modified,
    newVals.last_fetched_at,
    newVals.last_error,
    newVals.title,
    newVals.site_url,
    id
  );
}

export {};
