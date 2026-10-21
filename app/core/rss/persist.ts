import Database from 'better-sqlite3';
import type { ParsedItem } from './parser';
import { computeDedupeKey } from './dedupe';
import {
  createFeed,
  getFeedByUrl as getFeedByUrlDao,
  updateFeedCache as updateFeedCacheDao,
  type Feed,
} from '../storage/dao/feedsDao';
import { insertItems as insertStoredItems, type NewItem } from '../storage/dao/itemsDao';

export type FeedRow = Feed;

export function getFeedByUrl(db: Database.Database, url: string): FeedRow | null {
  return getFeedByUrlDao(db, url) ?? null;
}

export function upsertFeedMeta(
  db: Database.Database,
  url: string,
  meta: { title?: string | null; site_url?: string | null }
): FeedRow {
  return createFeed(db, url, { title: meta.title ?? null, siteUrl: meta.site_url ?? null });
}

export function updateFeedCache(
  db: Database.Database,
  feedId: number,
  data: { etag?: string | null; lastModified?: string | null; error?: string | null }
) {
  updateFeedCacheDao(db, feedId, data);
}

export function insertItems(db: Database.Database, feedId: number, items: ParsedItem[]): number {
  const rows: NewItem[] = items.map((item) => ({
    guid: item.guid ?? null,
    link: item.link,
    title: item.title ?? null,
    description: item.description ?? null,
    published_at: item.publishedAt ?? null,
    dedupe_key: computeDedupeKey({ guid: item.guid, link: item.link, title: item.title }),
  }));
  return insertStoredItems(db, feedId, rows);
}

export function logFetch(
  db: Database.Database,
  params: {
    feedId?: number;
    status: string;
    httpStatus?: number | null;
    durationMs?: number | null;
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
