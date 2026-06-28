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
});