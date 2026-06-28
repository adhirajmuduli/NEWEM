import Database from 'better-sqlite3';
import type { ParsedItem } from './parser';
import { computeDedupeKey } from './dedupe';
import { assertValidFeedUrl } from './url';

export type FeedRow = {
  id: number;
  url: string;
  title?: string | null;
  site_url?: string | null;
  etag?: string | null;
  last_modified?: string | null;
  last_fetched_at?: string | null;
  last_error?: string | null;
  is_enabled: number;
  is_fetching?: number;
};

export function getFeedByUrl(db: Database.Database, url: string): FeedRow | null {
  const normalized = assertValidFeedUrl(url);
  const row = db.prepare(`SELECT * FROM feeds WHERE url = ?`).get(normalized);
  return (row as FeedRow) ?? null;
}

export function upsertFeedMeta(
  db: Database.Database,
  url: string,
  meta: { title?: string | null; site_url?: string | null }
): FeedRow {
  const normalized = assertValidFeedUrl(url);
  const existing = db.prepare(`SELECT * FROM feeds WHERE url = ?`).get(normalized) as FeedRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE feeds
       SET title = COALESCE(@title, title),
           site_url = COALESCE(@site_url, site_url),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = @id`
    ).run({ id: existing.id, title: meta.title ?? null, site_url: meta.site_url ?? null });

    return { ...existing, ...meta, url: normalized };
  }

  const res = db.prepare(
    `INSERT INTO feeds (url, title, site_url, is_enabled)
     VALUES (@url, @title, @site_url, 1)`
  ).run({ url: normalized, title: meta.title ?? null, site_url: meta.site_url ?? null });

  return {
    id: Number(res.lastInsertRowid),
    url: normalized,
    title: meta.title ?? null,
    site_url: meta.site_url ?? null,
    is_enabled: 1,
  };
}

export function updateFeedCache(
  db: Database.Database,
  feedId: number,
  data: { etag?: string | null; lastModified?: string | null; error?: string | null }
) {
  db.prepare(
    `UPDATE feeds
     SET etag = COALESCE(@etag, etag),
         last_modified = COALESCE(@last_modified, last_modified),
         last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_error = @error,
         is_fetching = 0,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({ id: feedId, etag: data.etag ?? null, last_modified: data.lastModified ?? null, error: data.error ?? null });
}

export function insertItems(db: Database.Database, feedId: number, items: ParsedItem[]): number {
  const stmt = db.prepare(
    `INSERT INTO items (feed_id, guid, link, title, description, published_at, dedupe_key)
     VALUES (@feed_id, @guid, @link, @title, @description, @published_at, @dedupe_key)
     ON CONFLICT(dedupe_key) DO NOTHING`
  );

  let inserted = 0;
  for (const item of items) {
    const res = stmt.run({
      feed_id: feedId,
      guid: item.guid ?? null,
      link: item.link,
      title: item.title ?? null,
      description: item.description ?? null,
      published_at: item.publishedAt ?? null,
      dedupe_key: computeDedupeKey({ guid: item.guid, link: item.link, title: item.title }),
    });
    if (res.changes > 0) inserted += 1;
  }
  return inserted;
}

export function logFetch(
  db: Database.Database,
  params: {
    feedId?: number;
    status: string;
    httpStatus?: number | null;
    durationMs?: number;
    message?: string | null;
  }
) {
  db.prepare(
    `INSERT INTO fetch_log (feed_id, status, http_status, fetched_at, duration_ms, message)
     VALUES (@feed_id, @status, @http_status, strftime('%Y-%m-%dT%H:%M:%fZ','now'), @duration_ms, @message)`
  ).run({
    feed_id: params.feedId ?? null,
    status: params.status,
    http_status: params.httpStatus ?? null,
    duration_ms: params.durationMs ?? null,
    message: params.message ?? null,
  });
}

export {};