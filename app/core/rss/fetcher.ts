import Database from 'better-sqlite3';
import { fetch } from 'undici';
import { parseFeed } from './parser';
import { computeDedupeKey } from './dedupe';
import { buildConditionalHeaders, extractCacheFromHeaders } from './cache';

import { insertItems, NewItem } from '../storage/dao/itemsDao';
import { updateMeta } from '../storage/dao/feedsDao';

export type FetchResult = { status: 'ok' | 'not_modified' | 'error'; newItems: number };

function nowIso(): string {
  return new Date().toISOString();
}

// Centralized helper to write fetch_log
function logFetch(
  db: Database.Database,
  feedId: number,
  status: 'ok' | 'not_modified' | 'error',
  httpStatus: number | null,
  durationMs: number,
  message: string | null
): void {
  db
    .prepare(
      `INSERT INTO fetch_log(feed_id, status, http_status, fetched_at, duration_ms, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(feedId, status, httpStatus, nowIso(), durationMs, message);
}

// Normalize undici headers so we avoid DOM Headers typing here
async function httpGet(url: string, headers: Record<string, string>): Promise<{
  status: number;
  headers: Map<string, string>;
  body: string;
}> {
  const res = await fetch(url, { method: 'GET', headers });
  const headerMap = new Map<string, string>();
  res.headers.forEach((value, key) => headerMap.set(key.toLowerCase(), value));
  const text = res.status === 304 ? '' : await res.text();
  return { status: res.status, headers: headerMap, body: text };
}

export async function fetchAndIngestFeed(
  db: Database.Database,
  feedId: number,
  url: string,
  cache: { etag?: string | null; last_modified?: string | null }
): Promise<FetchResult> {
  const started = Date.now();
  const headers = buildConditionalHeaders(cache);

  try {
    const res = await httpGet(url, headers);
    const duration = Date.now() - started;

    if (res.status === 304) {
      updateMeta(db, feedId, {
        last_fetched_at: nowIso(),
        last_error: null,
      });
      logFetch(db, feedId, 'not_modified', 304, duration, null);
      return { status: 'not_modified', newItems: 0 };
    }

    if (res.status >= 200 && res.status < 300) {
      const parsed = parseFeed(res.body);
      const cacheHdrs = extractCacheFromHeaders(res.headers);

      // insertItems returns number of rows inserted
      const toInsert: NewItem[] = parsed.items.map((it) => ({
        guid: it.guid ?? null,
        link: it.link,
        title: it.title ?? null,
        description: it.description ?? null,
        published_at: it.publishedAt ?? null,
        dedupe_key: computeDedupeKey({
          guid: it.guid ?? undefined,
          link: it.link,
          title: it.title ?? undefined,
        }),
      }));
      const inserted: number = insertItems(db, feedId, toInsert);

      updateMeta(db, feedId, {
        etag: cacheHdrs.etag ?? null,
        last_modified: cacheHdrs.last_modified ?? null,
        last_fetched_at: nowIso(),
        last_error: null,
        title: parsed.feed.title ?? null,
        site_url: parsed.feed.site_url ?? null,
      });

      logFetch(db, feedId, 'ok', res.status, duration, `inserted=${String(inserted)}`);
      return { status: 'ok', newItems: inserted };
    }

    // Non-success HTTP
    updateMeta(db, feedId, { last_fetched_at: nowIso(), last_error: `HTTP ${res.status}` });
    logFetch(db, feedId, 'error', res.status, duration, null);
    return { status: 'error', newItems: 0 };
  } catch (e) {
    const duration = Date.now() - started;
    const message = e instanceof Error ? e.message : String(e);
    updateMeta(db, feedId, { last_fetched_at: nowIso(), last_error: message });
    logFetch(db, feedId, 'error', null, duration, message);
    return { status: 'error', newItems: 0 };
  }
}