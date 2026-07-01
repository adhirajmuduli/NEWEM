import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initDb } from '../../app/core/storage/db';
import { createFeed } from '../../app/core/storage/dao/feedsDao';
import { assignFeedToSection, createSection } from '../../app/core/storage/dao/sectionsDao';
import { registerIpcHandlers } from '../../app/main/ipc';

const tempRoots: string[] = [];

type Handler = (_evt: unknown, payload?: any) => Promise<any>;

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-ipc-test-'));
  tempRoots.push(dir);
  const db = initDb(dir);
  db.exec('DELETE FROM feed_sections; DELETE FROM items; DELETE FROM feeds; DELETE FROM sections;');
  return db;
}

function rss(title: string, link: string) {
  return `<?xml version="1.0"?><rss><channel><title>${title}</title><link>https://example.com</link><item><guid>${link}</guid><title>${title}</title><link>${link}</link></item></channel></rss>`;
}

function handlers() {
  const map = new Map<string, Handler>();
  registerIpcHandlers({ handle: (channel, listener) => map.set(channel, listener as Handler) });
  return map;
}

afterEach(() => {
  vi.restoreAllMocks();
  closeDb();
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('manual sync IPC', () => {
  it('returns deterministic summaries for feed, section, and global refresh scopes', async () => {
    const db = tempDb();
    const section = createSection(db, 'Manual', 0, 'manual');
    const feedA = createFeed(db, 'https://example.com/a.xml');
    const feedB = createFeed(db, 'https://example.com/b.xml');
    assignFeedToSection(db, feedA.id, section.id);
    assignFeedToSection(db, feedB.id, section.id);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/a.xml')) return new Response(rss('A', 'https://example.com/a'), { status: 200 });
        return new Response(null, { status: 304 });
      })
    );

    const syncTrigger = handlers().get('sync:trigger');
    expect(syncTrigger).toBeTruthy();

    const oneFeed = await syncTrigger!(null, { feedId: feedA.id });
    expect(oneFeed).toMatchObject({ status: 'ok', scope: 'feed', requested: 1, triggered: 1, ok: 1, errors: 0, newItems: 1 });

    const sectionResult = await syncTrigger!(null, { sectionId: section.id });
    expect(sectionResult).toMatchObject({ status: 'ok', scope: 'section', requested: 2, triggered: 2, notModified: 1, errors: 0 });

    const allResult = await syncTrigger!(null, {});
    expect(allResult).toMatchObject({ status: 'ok', scope: 'all', requested: 2, triggered: 2, notModified: 1, errors: 0 });
  });

  it('refreshes all requested feeds with a four-request network ceiling', async () => {
    const db = tempDb();
    const section = createSection(db, 'Concurrent', 0, 'concurrent');
    for (let index = 0; index < 9; index += 1) {
      const feed = createFeed(db, `https://example.com/${index}.xml`);
      assignFeedToSection(db, feed.id, section.id);
    }
    let active = 0;
    let maximum = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 4));
      active -= 1;
      return new Response(`<?xml version="1.0"?><rss><channel><title>Concurrent</title><link>https://example.com</link></channel></rss>`, { status: 200 });
    }));

    const result = await handlers().get('sync:trigger')!(null, { sectionId: section.id });
    expect(result).toMatchObject({ requested: 9, triggered: 9, ok: 9 });
    expect(maximum).toBe(4);
  });

  it('keeps a tested Washington Post feed mapped after add, duplicate add, and refresh', async () => {
    const db = tempDb();
    const section = createSection(db, 'World', 0, 'world');
    const url = 'https://feeds.washingtonpost.com/rss/world';
    vi.stubGlobal('fetch', vi.fn(async (requestUrl: string) => {
      expect(requestUrl).toBe(url);
      return new Response(rss('Washington Post World', 'https://www.washingtonpost.com/world/example'), {
        status: 200,
        headers: { 'content-type': 'text/xml; charset=utf-8' },
      });
    }));

    const ipc = handlers();
    const tested = await ipc.get('feeds:test')!(null, { url });
    expect(tested).toMatchObject({ status: 'ok', feedUrl: url, title: 'Washington Post World' });

    const first = await ipc.get('feeds:addToSection')!(null, { sectionId: section.id, url, enabled: true });
    const duplicate = await ipc.get('feeds:addToSection')!(null, { sectionId: section.id, url, enabled: true });
    expect(first).toMatchObject({ changed: 1, feed: { url, title: 'Washington Post World', is_enabled: 1 } });
    expect(duplicate).toMatchObject({ changed: 0, feed: { id: first.feed.id } });

    const synced = await ipc.get('sync:trigger')!(null, { feedId: first.feed.id });
    expect(synced).toMatchObject({ status: 'ok', errors: 0 });
    expect((db.prepare('SELECT COUNT(*) AS count FROM feed_sections WHERE feed_id=? AND section_id=?').get(first.feed.id, section.id) as { count: number }).count).toBe(1);
  });
});
