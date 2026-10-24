import Database from 'better-sqlite3';
import { fetchFeed, type FetchFeedOptions, type FetchError } from './fetch';
import { parseFeed } from './parser';
import { insertItems, logFetch } from './persist';
import { normalizeFeedUrl } from './url';
import { createFeed, getFeed, getFeedByUrl, listFeeds, markFeedError, tryLockFeed, updateFeedCache } from '../storage/dao/feedsDao';
import { listFeedsForSection } from '../storage/dao/sectionsDao';

export type SyncStatus = 'ok' | 'not_modified' | 'error';

export type SyncResult = {
  status: SyncStatus;
  feedId?: number;
  url: string;
  normalizedUrl: string;
  httpStatus?: number | null;
  newItems: number;
  error?: FetchError | { code: 'parse_error' | 'feed_not_found' | 'feed_disabled' | 'feed_muted' | 'feed_in_progress'; message: string };
};

export type ManualSyncScope = 'feed' | 'section' | 'all';

export type ManualSyncResult = {
  status: 'ok';
  scope: ManualSyncScope;
  requested: number;
  triggered: number;
  ok: number;
  notModified: number;
  errors: number;
  newItems: number;
  results: SyncResult[];
};

export type SyncProgress = { scope: ManualSyncScope; completed: number; total: number; percent: number; feedId?: number };

const RETRY_BASE_MS = 60_000;
const RETRY_CAP_MS = 24 * 60 * 60 * 1000;
const RETRY_AFTER_MAX_SECONDS = 60 * 60;
const GONE_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

function computeNextRetryAt(consecutiveFailures: number, retryAfterSeconds: number | null, httpStatus: number | null) {
  const now = Date.now();
  if (httpStatus === 410) return new Date(now + GONE_RETRY_MS).toISOString();
  if (retryAfterSeconds != null) {
    const seconds = Math.min(Math.max(Math.trunc(retryAfterSeconds), 1), RETRY_AFTER_MAX_SECONDS);
    return new Date(now + seconds * 1000).toISOString();
  }
  const base = Math.min(RETRY_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1), RETRY_CAP_MS);
  const jitter = 0.8 + Math.random() * 0.4;
  return new Date(now + Math.round(base * jitter)).toISOString();
}

function messageForError(error: SyncResult['error']) {
  return error ? `${error.code}: ${error.message}` : null;
}

function preservedValidators(existing?: { etag?: string | null; last_modified?: string | null }) {
  return { etag: existing?.etag ?? null, lastModified: existing?.last_modified ?? null };
}

function persistSyncResult(db: Database.Database, result: SyncResult, meta?: { etag?: string | null; lastModified?: string | null }) {
  if (!result.feedId) return;
  let consecutiveFailures: number = 0;
  let nextRetryAt: string | null = null;
  if (result.status === 'error') {
    const current = db.prepare('SELECT consecutive_failures FROM feeds WHERE id=?').get(result.feedId) as
      | { consecutive_failures?: number | null }
      | undefined;
    consecutiveFailures = (current?.consecutive_failures ?? 0) + 1;
    const retryAfterSeconds = result.error && 'retryAfterSeconds' in result.error
      ? (result.error.retryAfterSeconds ?? null)
      : null;
    nextRetryAt = computeNextRetryAt(consecutiveFailures, retryAfterSeconds, result.httpStatus ?? null);
  }
  updateFeedCache(db, result.feedId, {
    etag: meta?.etag ?? null,
    lastModified: meta?.lastModified ?? null,
    error: result.status === 'error' ? messageForError(result.error) : null,
    consecutiveFailures,
    nextRetryAt,
  });
  logFetch(db, {
    feedId: result.feedId,
    status: result.status,
    httpStatus: result.httpStatus ?? null,
    message: result.status === 'ok' ? `inserted=${result.newItems}` : messageForError(result.error),
  });
}

export async function syncFeedByUrl(
  db: Database.Database,
  feedUrl: string,
  opts?: FetchFeedOptions
): Promise<SyncResult> {
  const normalized = normalizeFeedUrl(feedUrl);
  if (!normalized.ok) {
    return {
      status: 'error',
      url: feedUrl,
      normalizedUrl: feedUrl,
      httpStatus: null,
      newItems: 0,
      error: { code: normalized.code, message: normalized.message },
    };
  }
  const normalizedUrl = normalized.url;
  const existing = getFeedByUrl(db, normalizedUrl);
  if (existing && !tryLockFeed(db, existing.id)) {
    return {
      status: 'error',
      feedId: existing.id,
      url: feedUrl,
      normalizedUrl,
      httpStatus: null,
      newItems: 0,
      error: { code: 'feed_in_progress', message: `Feed ${existing.id} is already refreshing` },
    };
  }
  const res = await fetchFeed(normalizedUrl, {
    etag: existing?.etag ?? undefined,
    lastModified: existing?.last_modified ?? undefined,
    ...opts,
  });

  if (res.status === 'error') {
    const result: SyncResult = {
      status: 'error',
      feedId: existing?.id,
      url: feedUrl,
      normalizedUrl,
      httpStatus: res.httpStatus ?? null,
      newItems: 0,
      error: res.error,
    };
    db.transaction(() => persistSyncResult(db, result, preservedValidators(existing)))();
    return result;
  }

  if (res.status === 'not_modified') {
    const result: SyncResult = {
      status: 'not_modified',
      feedId: existing?.id,
      url: feedUrl,
      normalizedUrl,
      httpStatus: res.httpStatus ?? 304,
      newItems: 0,
    };
    db.transaction(() => persistSyncResult(db, result, {
      etag: res.etag ?? existing?.etag ?? null,
      lastModified: res.lastModified ?? existing?.last_modified ?? null,
    }))();
    return result;
  }

  if (!res.body) {
    const result: SyncResult = {
      status: 'error',
      feedId: existing?.id,
      url: feedUrl,
      normalizedUrl,
      httpStatus: res.httpStatus ?? null,
      newItems: 0,
      error: { code: 'parse_error', message: 'Feed response was empty' },
    };
    db.transaction(() => persistSyncResult(db, result, preservedValidators(existing)))();
    return result;
  }

  try {
    const parsed = parseFeed(res.body);
    const result = db.transaction(() => {
      const feed = createFeed(db, normalizedUrl, { title: parsed.feed.title ?? null, siteUrl: parsed.feed.site_url ?? null });
      const inserted = insertItems(db, feed.id, parsed.items);
      const syncResult: SyncResult = {
        status: 'ok',
        feedId: feed.id,
        url: feedUrl,
        normalizedUrl,
        httpStatus: res.httpStatus ?? 200,
        newItems: inserted,
      };
      persistSyncResult(db, syncResult, { etag: res.etag ?? null, lastModified: res.lastModified ?? null });
      return syncResult;
    })();
    return result;
  } catch (error) {
    const result: SyncResult = {
      status: 'error',
      feedId: existing?.id,
      url: feedUrl,
      normalizedUrl,
      httpStatus: res.httpStatus ?? null,
      newItems: 0,
      error: { code: 'parse_error', message: error instanceof Error ? error.message : String(error) },
    };
    db.transaction(() => persistSyncResult(db, result, preservedValidators(existing)))();
    return result;
  }
}

export async function syncFeedById(db: Database.Database, feedId: number, opts?: FetchFeedOptions) {
  const feed = getFeed(db, feedId);
  if (!feed) {
    return {
      status: 'error',
      feedId,
      url: '',
      normalizedUrl: '',
      httpStatus: null,
      newItems: 0,
      error: { code: 'feed_not_found', message: `Feed ${feedId} does not exist` },
    } satisfies SyncResult;
  }
  if (feed.is_enabled !== 1) {
    return {
      status: 'error',
      feedId,
      url: feed.url,
      normalizedUrl: feed.url,
      httpStatus: null,
      newItems: 0,
      error: { code: 'feed_disabled', message: `Feed ${feedId} is disabled` },
    } satisfies SyncResult;
  }
  if (feed.is_muted === 1) {
    return {
      status: 'error',
      feedId,
      url: feed.url,
      normalizedUrl: feed.url,
      httpStatus: null,
      newItems: 0,
      error: { code: 'feed_muted', message: `Feed ${feedId} is muted` },
    } satisfies SyncResult;
  }
  try {
    return await syncFeedByUrl(db, feed.url, opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    markFeedError(db, feedId, message);
    return {
      status: 'error',
      feedId,
      url: feed.url,
      normalizedUrl: feed.url,
      httpStatus: null,
      newItems: 0,
      error: { code: 'network_error', message },
    } satisfies SyncResult;
  }
}

export const MAX_SYNC_CONCURRENCY = 4;

export async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  if (values.length === 0) return [];
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, Math.trunc(limit)), values.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}
function summarize(scope: ManualSyncScope, requested: number, results: SyncResult[]): ManualSyncResult {
  return {
    status: 'ok',
    scope,
    requested,
    triggered: results.length,
    ok: results.filter((result) => result.status === 'ok').length,
    notModified: results.filter((result) => result.status === 'not_modified').length,
    errors: results.filter((result) => result.status === 'error').length,
    newItems: results.reduce((sum, result) => sum + result.newItems, 0),
    results,
  };
}

export async function syncFeeds(
  db: Database.Database,
  feedIds: number[],
  scope: ManualSyncScope,
  opts?: FetchFeedOptions,
  onProgress?: (progress: SyncProgress) => void
) {
  let completed = 0;
  onProgress?.({ scope, completed: 0, total: feedIds.length, percent: feedIds.length === 0 ? 100 : 0 });
  const results = await mapWithConcurrency(feedIds, MAX_SYNC_CONCURRENCY, async (feedId) => {
    const result = await syncFeedById(db, feedId, opts);
    completed += 1;
    onProgress?.({
      scope,
      completed,
      total: feedIds.length,
      percent: Math.round((completed / feedIds.length) * 100),
      feedId,
    });
    return result;
  });
  return summarize(scope, feedIds.length, results);
}

export async function syncSection(
  db: Database.Database,
  sectionId: number,
  opts?: FetchFeedOptions,
  onProgress?: (progress: SyncProgress) => void
) {
  const feeds = listFeedsForSection(db, sectionId, { enabledOnly: true }) as Array<{
    id: number;
    is_muted: number | null;
  }>;
  const feedIds = feeds.filter((feed) => feed.is_muted !== 1).map((feed) => feed.id);
  return syncFeeds(db, feedIds, 'section', opts, onProgress);
}

export async function syncAllFeeds(
  db: Database.Database,
  opts?: FetchFeedOptions,
  onProgress?: (progress: SyncProgress) => void
) {
  const mappedFeedIds = new Set(
    (db.prepare('SELECT DISTINCT feed_id FROM feed_sections').all() as Array<{ feed_id: number }>).map((row) => row.feed_id)
  );
  const feeds = listFeeds(db)
    .filter((feed) => mappedFeedIds.has(feed.id) && feed.is_enabled === 1 && feed.is_muted !== 1);
  return syncFeeds(db, feeds.map((feed) => feed.id), 'all', opts, onProgress);
}

export {};
