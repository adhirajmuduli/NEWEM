import Database from 'better-sqlite3';
import { fetchFeed } from './fetch';
import { parseFeed } from './parser';
import {
  getFeedByUrl,
  upsertFeedMeta,
  updateFeedCache,
  insertItems,
  logFetch,
} from './persist';

export type SyncResult = {
  status: 'ok' | 'not_modified' | 'error';
  newItems: number;
};

export async function syncFeedByUrl(
  db: Database.Database,
  feedUrl: string
): Promise<SyncResult> {
  const start = Date.now();
  const existing = getFeedByUrl(db, feedUrl);

  const res = await fetchFeed(feedUrl, {
    etag: existing?.etag ?? undefined,
    lastModified: existing?.last_modified ?? undefined,
  });

  const duration = Date.now() - start;

  if (res.status === 'not_modified') {
    if (existing) {
      updateFeedCache(db, existing.id, {
        etag: res.etag ?? existing.etag ?? null,
        lastModified: res.lastModified ?? existing.last_modified ?? null,
      });

      logFetch(db, {
        feedId: existing.id,
        status: 'not_modified',
        durationMs: duration,
      });
    }

    return { status: 'not_modified', newItems: 0 };
  }

  if (res.status !== 'ok' || !res.body) {
    if (existing) {
      updateFeedCache(db, existing.id, {
        error: 'fetch_failed',
      });

      logFetch(db, {
        feedId: existing.id,
        status: 'error',
        durationMs: duration,
        message: 'fetch_failed',
      });
    }

    return { status: 'error', newItems: 0 };
  }

  const parsed = parseFeed(res.body);
  const feed = upsertFeedMeta(db, feedUrl, parsed.feed);

  const inserted = insertItems(db, feed.id, parsed.items);

  updateFeedCache(db, feed.id, {
    etag: res.etag ?? null,
    lastModified: res.lastModified ?? null,
  });

  logFetch(db, {
    feedId: feed.id,
    status: 'ok',
    durationMs: duration,
    message: `inserted=${inserted}`,
  });

  return { status: 'ok', newItems: inserted };
}
