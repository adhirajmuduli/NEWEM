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
  consecutive_failures?: number | null;
  next_retry_at?: string | null;
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
       title=CASE WHEN feeds.title IS NULL OR TRIM(feeds.title) = '' THEN excluded.title ELSE feeds.title END,
       site_url=CASE WHEN feeds.site_url IS NULL OR TRIM(feeds.site_url) = '' THEN excluded.site_url ELSE feeds.site_url END,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     RETURNING *`
  );
  return stmt.get({
    url: normalizedUrl,
    title: metadata?.title ?? null,
    site_url: metadata?.siteUrl ?? null,
  }) as Feed;
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

export function getFeedByUrl(db: Database.Database, url: string): Feed | undefined {
  const normalized = assertValidFeedUrl(url);
  return db.prepare(`SELECT * FROM feeds WHERE url = ?`).get(normalized) as Feed | undefined;
}

export function updateFeedCache(
  db: Database.Database,
  id: number,
  data: {
    etag?: string | null;
    lastModified?: string | null;
    error?: string | null;
    consecutiveFailures?: number | null;
    nextRetryAt?: string | null;
  }
) {
  db.prepare(
    `UPDATE feeds
     SET etag = @etag,
         last_modified = @lastModified,
         last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_error = @error,
         is_fetching = 0,
         consecutive_failures = @consecutiveFailures,
         next_retry_at = @nextRetryAt,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({
    id,
    etag: data.etag ?? null,
    lastModified: data.lastModified ?? null,
    error: data.error ?? null,
    consecutiveFailures: data.consecutiveFailures ?? 0,
    nextRetryAt: data.nextRetryAt ?? null,
  });
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

export {};

