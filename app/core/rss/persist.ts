import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import type { ParsedItem } from './parser';

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
};

/* ----------------------------- helpers ----------------------------- */

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeLink(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    const drop = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
    ]);
    for (const k of Array.from(url.searchParams.keys())) {
      if (drop.has(k)) url.searchParams.delete(k);
    }
    if (url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return u.trim();
  }
}

export function computeDedupeKey(item: ParsedItem): string {
  const guid = (item.guid ?? '').trim();
  const link = normalizeLink(item.link);
  const title = (item.title ?? '').trim().toLowerCase();
  const basis = guid || `${link}|${title}`;
  return sha256(basis);
}

/* ----------------------------- feeds ----------------------------- */

export function getFeedByUrl(db: Database.Database, url: string): FeedRow | null {
  const row = db.prepare(`SELECT * FROM feeds WHERE url = ?`).get(url);
  return (row as FeedRow) ?? null;
}

export function upsertFeedMeta(
  db: Database.Database,
  url: string,
  meta: { title?: string | null; site_url?: string | null }
): FeedRow {
  const existing = getFeedByUrl(db, url);

  if (existing) {
    db.prepare(
      `
      UPDATE feeds
      SET
        title = COALESCE(@title, title),
        site_url = COALESCE(@site_url, site_url),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = @id
      `
    ).run({
      id: existing.id,
      title: meta.title ?? null,
      site_url: meta.site_url ?? null,
    });

    return { ...existing, ...meta };
  }

  const res = db.prepare(
    `
    INSERT INTO feeds (url, title, site_url, is_enabled)
    VALUES (@url, @title, @site_url, 1)
    `
  ).run({
    url,
    title: meta.title ?? null,
    site_url: meta.site_url ?? null,
  });

  return {
    id: Number(res.lastInsertRowid),
    url,
    title: meta.title ?? null,
    site_url: meta.site_url ?? null,
    is_enabled: 1,
  };
}

export function updateFeedCache(
  db: Database.Database,
  feedId: number,
  data: {
    etag?: string | null;
    lastModified?: string | null;
    error?: string | null;
  }
) {
  db.prepare(
    `
    UPDATE feeds
    SET
      etag = COALESCE(@etag, etag),
      last_modified = COALESCE(@last_modified, last_modified),
      last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      last_error = @error,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = @id
    `
  ).run({
    id: feedId,
    etag: data.etag ?? null,
    last_modified: data.lastModified ?? null,
    error: data.error ?? null,
  });
}

/* ----------------------------- items ----------------------------- */

export function insertItems(
  db: Database.Database,
  feedId: number,
  items: ParsedItem[]
): number {
  const stmt = db.prepare(
    `
    INSERT INTO items (
      feed_id,
      guid,
      link,
      title,
      description,
      published_at,
      dedupe_key
    )
    VALUES (
      @feed_id,
      @guid,
      @link,
      @title,
      @description,
      @published_at,
      @dedupe_key
    )
    ON CONFLICT(dedupe_key) DO NOTHING
    `
  );

  const tx = db.transaction((rows: ParsedItem[]) => {
    let inserted = 0;

    for (const r of rows) {
      const res = stmt.run({
        feed_id: feedId,
        guid: r.guid ?? null,
        link: r.link,
        title: r.title ?? null,
        description: r.description ?? null,
        published_at: r.publishedAt ?? null,
        dedupe_key: computeDedupeKey(r),
      });

      if (res.changes > 0) inserted++;
    }

    return inserted;
  });

  return tx(items);
}

/* ----------------------------- logging ----------------------------- */

export function logFetch(
  db: Database.Database,
  params: {
    feedId?: number;
    status: string;
    httpStatus?: number;
    durationMs?: number;
    message?: string;
  }
) {
  db.prepare(
    `
    INSERT INTO fetch_log (
      feed_id,
      status,
      http_status,
      fetched_at,
      duration_ms,
      message
    )
    VALUES (
      @feed_id,
      @status,
      @http_status,
      strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      @duration_ms,
      @message
    )
    `
  ).run({
    feed_id: params.feedId ?? null,
    status: params.status,
    http_status: params.httpStatus ?? null,
    duration_ms: params.durationMs ?? null,
    message: params.message ?? null,
  });
}
