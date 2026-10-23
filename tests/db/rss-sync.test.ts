import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initDb } from '../../app/core/storage/db';
import { createFeed, getFeed } from '../../app/core/storage/dao/feedsDao';
import { assignFeedToSection, createSection } from '../../app/core/storage/dao/sectionsDao';
import { syncFeedById } from '../../app/core/rss/sync';
import { getItemsBySection } from '../../app/core/storage/dao/itemsDao';
import { setHostLookupOverride } from '../../app/core/rss/dnsGuard';

const tempRoots: string[] = [];

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-sync-test-'));
  tempRoots.push(dir);
  return initDb(dir);
}

function rss(items: string) {
  return `<?xml version="1.0"?><rss><channel><title>Example</title><link>https://example.com</link>${items}</channel></rss>`;
}

function item(title: string, link: string, guid = link) {
  return `<item><guid>${guid}</guid><title>${title}</title><link>${link}</link><description>${title}</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>`;
}

beforeEach(() => {
  setHostLookupOverride(async () => ['203.0.113.10']);
});

afterEach(() => {
  setHostLookupOverride(null);
  vi.restoreAllMocks();
  closeDb();
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('canonical RSS sync', () => {
  it('persists 200 OK items, metadata, and fetch logs', async () => {
    const db = tempDb();
    const section = createSection(db, 'Sync', 0, 'sync');
    const feed = createFeed(db, 'https://example.com/rss.xml');
    assignFeedToSection(db, feed.id, section.id);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(rss(item('A', 'https://example.com/a')), {
      status: 200,
      headers: { etag: 'e1', 'last-modified': 'lm1', 'content-type': 'text/html' },
    })));

    const result = await syncFeedById(db, feed.id);

    expect(result).toMatchObject({ status: 'ok', newItems: 1, httpStatus: 200 });
    expect(getItemsBySection(db, section.id).map((row) => row.title)).toEqual(['A']);
    expect(getFeed(db, feed.id)).toMatchObject({ etag: 'e1', last_modified: 'lm1', last_error: null, is_fetching: 0 });
    expect(db.prepare(`SELECT status, http_status, message FROM fetch_log WHERE feed_id=?`).get(feed.id)).toMatchObject({
      status: 'ok',
      http_status: 200,
      message: 'inserted=1',
    });
  });

  it('handles 304 Not Modified and preserves cache metadata', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    db.prepare(`UPDATE feeds SET etag='old', last_modified='oldlm' WHERE id=?`).run(feed.id);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 304, headers: { etag: 'new' } })));

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('not_modified');
    expect(getFeed(db, feed.id)?.etag).toBe('new');
    expect(db.prepare(`SELECT status, http_status FROM fetch_log WHERE feed_id=?`).get(feed.id)).toMatchObject({
      status: 'not_modified',
      http_status: 304,
    });
  });

  it('deduplicates repeated feed items with one canonical dedupe key implementation', async () => {
    const db = tempDb();
    const section = createSection(db, 'Dedupe', 0, 'dedupe');
    const feed = createFeed(db, 'https://example.com/rss.xml');
    assignFeedToSection(db, feed.id, section.id);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(rss(
      item('A', 'https://example.com/a?utm_source=x', 'same-guid') + item('A updated', 'https://example.com/a?utm_source=y', 'same-guid')
    ), { status: 200 })));

    const result = await syncFeedById(db, feed.id);

    expect(result.newItems).toBe(1);
    expect(getItemsBySection(db, section.id, { includeSeen: true })).toHaveLength(1);
  });

  it('records structured errors for invalid XML and HTTP failures', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<rss><broken></rss>', { status: 200 })));

    const invalid = await syncFeedById(db, feed.id);
    expect(invalid.status).toBe('error');
    expect(invalid.error?.code).toBe('parse_error');
    expect(getFeed(db, feed.id)?.last_error).toContain('parse_error');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));
    const httpError = await syncFeedById(db, feed.id);
    expect(httpError.status).toBe('error');
    expect(httpError.error?.code).toBe('http_error');
    expect(db.prepare(`SELECT COUNT(*) AS count FROM fetch_log WHERE feed_id=? AND status='error'`).get(feed.id)).toMatchObject({ count: 2 });
  });

  it('invalidates stale cache validators when a 200 response omits them', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    db.prepare(`UPDATE feeds SET etag='stale-etag', last_modified='stale-lm' WHERE id=?`).run(feed.id);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(rss(item('Fresh', 'https://example.com/fresh')), { status: 200 })));

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('ok');
    expect(getFeed(db, feed.id)?.etag).toBeNull();
    expect(getFeed(db, feed.id)?.last_modified).toBeNull();
  });

  it('preserves stored cache validators when a 304 response omits them', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    db.prepare(`UPDATE feeds SET etag='stored-etag', last_modified='stored-lm' WHERE id=?`).run(feed.id);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 304 })));

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('not_modified');
    expect(getFeed(db, feed.id)).toMatchObject({ etag: 'stored-etag', last_modified: 'stored-lm' });
  });

  it('refuses to refetch a feed while its refresh lock is held', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    db.prepare(`UPDATE feeds SET is_fetching=1 WHERE id=?`).run(feed.id);
    const fetchMock = vi.fn(async () => new Response(rss(item('A', 'https://example.com/a')), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('feed_in_progress');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('backs off exponentially after fetch failures and resets on success', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 500 })));

    await syncFeedById(db, feed.id);
    let row = getFeed(db, feed.id);
    expect(row?.consecutive_failures).toBe(1);
    let retry = Date.parse(row?.next_retry_at ?? '');
    expect(retry).toBeGreaterThan(Date.now() + 40_000);
    expect(retry).toBeLessThan(Date.now() + 80_000);

    await syncFeedById(db, feed.id);
    row = getFeed(db, feed.id);
    expect(row?.consecutive_failures).toBe(2);
    retry = Date.parse(row?.next_retry_at ?? '');
    expect(retry).toBeGreaterThan(Date.now() + 90_000);
    expect(retry).toBeLessThan(Date.now() + 150_000);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(rss(item('Recovered', 'https://example.com/recovered')), { status: 200 })));
    const result = await syncFeedById(db, feed.id);
    expect(result.status).toBe('ok');
    row = getFeed(db, feed.id);
    expect(row?.consecutive_failures).toBe(0);
    expect(row?.next_retry_at).toBeNull();
  });

  it('honors Retry-After on rate limited responses', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429, headers: { 'retry-after': '120' } })));

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('http_error');
    const row = getFeed(db, feed.id);
    expect(row?.consecutive_failures).toBe(1);
    const retry = Date.parse(row?.next_retry_at ?? '');
    expect(retry).toBeGreaterThan(Date.now() + 100_000);
    expect(retry).toBeLessThan(Date.now() + 140_000);
  });

  it('applies a long cooldown after HTTP 410 Gone without mutating user mute state', async () => {
    const db = tempDb();
    const feed = createFeed(db, 'https://example.com/rss.xml');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 410 })));

    const result = await syncFeedById(db, feed.id);

    expect(result.status).toBe('error');
    const row = getFeed(db, feed.id);
    expect(row?.consecutive_failures).toBe(1);
    expect(row?.is_muted).toBe(0);
    expect(row?.is_enabled).toBe(1);
    const retry = Date.parse(row?.next_retry_at ?? '');
    expect(retry).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });
});