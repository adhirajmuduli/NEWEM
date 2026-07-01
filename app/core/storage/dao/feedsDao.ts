import Database from 'better-sqlite3';
import { assertValidFeedUrl } from '../../rss/url';

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
  is_muted: number;
  is_fetching?: number;
  created_at: string;
  updated_at: string;
}

export function createFeed(
  db: Database.Database,
  url: string,
  metadata?: { title?: string | null; siteUrl?: string | null }
) {
  const normalizedUrl = assertValidFeedUrl(url);
  const stmt = db.prepare(
    `INSERT INTO feeds(url, title, site_url) VALUES (@url, @title, @site_url)
     ON CONFLICT(url) DO UPDATE SET
       title=COALESCE(excluded.title, feeds.title),
       site_url=COALESCE(excluded.site_url, feeds.site_url),
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     RETURNING *`
  );
  return stmt.get({
    url: normalizedUrl,
    title: metadata?.title ?? null,
    site_url: metadata?.siteUrl ?? null,
  }) as Feed;
}

export function isFeedDue(feed: { last_fetched_at?: string | null; fetch_interval_minutes?: number | null }) {
  if (!feed.last_fetched_at) return true;
  if (!feed.fetch_interval_minutes) return true;

  const last = new Date(feed.last_fetched_at).getTime();
  const now = Date.now();
  return now - last >= feed.fetch_interval_minutes * 60_000;
}

export function tryLockFeed(db: Database.Database, feedId: number): boolean {
  const r = db.prepare(
    `UPDATE feeds
     SET is_fetching = 1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ? AND COALESCE(is_fetching, 0) = 0`
  ).run(feedId);

  return r.changes === 1;
}

export function markFeedFetched(db: Database.Database, feedId: number) {
  db.prepare(
    `UPDATE feeds
     SET is_fetching = 0,
         last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_error = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(feedId);
}

export function markFeedError(db: Database.Database, feedId: number, message: string) {
  db.prepare(
    `UPDATE feeds
     SET is_fetching = 0,
         last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_error = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(message, feedId);
}

export function bulkAddFeeds(db: Database.Database, urlsText: string) {
  const urls = urlsText
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .map((u) => assertValidFeedUrl(u));
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
  const offset = Math.max(0, opts?.offset ?? 0);
  if (opts?.limit === undefined) {
    return db.prepare(`SELECT * FROM feeds ORDER BY id LIMIT -1 OFFSET ?`).all(offset) as Feed[];
  }
  const limit = Math.max(1, Math.trunc(opts.limit));
  return db.prepare(`SELECT * FROM feeds ORDER BY id LIMIT ? OFFSET ?`).all(limit, offset) as Feed[];
}

export function getFeed(db: Database.Database, id: number) {
  const stmt = db.prepare(`SELECT * FROM feeds WHERE id=?`);
  return stmt.get(id) as Feed | undefined;
}

export function setEnabled(db: Database.Database, id: number, enabled: boolean) {
  const stmt = db.prepare(
    `UPDATE feeds
     SET is_enabled=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`
  );
  stmt.run(enabled ? 1 : 0, id);
}


export function updateFeedSettings(
  db: Database.Database,
  id: number,
  updates: { enabled?: boolean; muted?: boolean; fetchIntervalMinutes?: number | null }
) {
  const current = getFeed(db, id);
  if (!current) return undefined;
  const enabled = updates.enabled === undefined ? current.is_enabled : updates.enabled ? 1 : 0;
  const muted = updates.muted === undefined ? current.is_muted : updates.muted ? 1 : 0;
  const interval = updates.fetchIntervalMinutes === undefined ? current.fetch_interval_minutes ?? null : updates.fetchIntervalMinutes;
  return db.prepare(
    `UPDATE feeds
     SET is_enabled=@enabled,
         is_muted=@muted,
         fetch_interval_minutes=@interval,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=@id
     RETURNING *`
  ).get({ id, enabled, muted, interval }) as Feed;
}
export function updateMeta(
  db: Database.Database,
  id: number,
  meta: Partial<Pick<Feed, 'etag' | 'last_modified' | 'last_fetched_at' | 'last_error' | 'title' | 'site_url'>>
) {
  const f = getFeed(db, id);
  if (!f) return;
  const newVals = {
    etag: meta.etag ?? f.etag ?? null,
    last_modified: meta.last_modified ?? f.last_modified ?? null,
    last_fetched_at: meta.last_fetched_at ?? f.last_fetched_at ?? null,
    last_error: meta.last_error ?? null,
    title: meta.title ?? f.title ?? null,
    site_url: meta.site_url ?? f.site_url ?? null,
  };
  const stmt = db.prepare(
    `UPDATE feeds
     SET etag=?, last_modified=?, last_fetched_at=?, last_error=?, title=?, site_url=?, is_fetching=0,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`
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
