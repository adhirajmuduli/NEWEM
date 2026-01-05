interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: any[]) => any): void;
}

import { getDb } from '../core/storage/db';
import { listFeeds, getFeed } from '../core/storage/dao/feedsDao';
import {
  getItemsBySection,
  markSeen as markItemsSeen,
  markSectionSeen,
  ItemRow,
} from '../core/storage/dao/itemsDao';
import { getShowSeen } from '../core/storage/dao/settingsDao';
import { fetchAndIngestFeed } from '../core/rss/fetcher';

export type SyncTriggerPayload = { feedId?: number };
export type SyncTriggerResponse = { status: 'ok'; triggered: number };

export type ItemsQueryPayload = {
  sectionId: number;
  limit?: number;
  before?: string | null;
  includeSeen?: boolean;
};
export type ItemsQueryResponse = { items: ItemRow[] };

export type MarkItemsSeenPayload = { itemIds: number[] };
export type MarkItemsSeenResponse = { changed: number };

export type MarkSectionSeenPayload = { sectionId: number };
export type MarkSectionSeenResponse = { changed: number };

export function registerIpcHandlers(ipc: IpcMainLike) {
  // Trigger manual refresh for a feed or all enabled feeds
  ipc.handle('sync:trigger', async (_evt, payload: SyncTriggerPayload): Promise<SyncTriggerResponse> => {
    const db = getDb();
    let count = 0;
    if (payload?.feedId) {
      const f = getFeed(db, payload.feedId);
      if (f && f.is_enabled === 1) {
        await fetchAndIngestFeed(db, f.id, f.url, {
          etag: f.etag ?? undefined,
          last_modified: f.last_modified ?? undefined,
        });
        count = 1;
      }
    } else {
      const feeds = listFeeds(db, { limit: 1000, offset: 0 }).filter((f) => f.is_enabled === 1);
      for (const f of feeds) {
        await fetchAndIngestFeed(db, f.id, f.url, {
          etag: f.etag ?? undefined,
          last_modified: f.last_modified ?? undefined,
        });
      }
      count = feeds.length;
    }
    console.log(JSON.stringify({ t: new Date().toISOString(), mod: 'ipc', level: 'info', msg: 'sync:trigger', meta: { triggered: count } }));
    return { status: 'ok', triggered: count };
  });

  // Query latest items by section with pagination
  ipc.handle('items:query', async (_evt, payload: ItemsQueryPayload): Promise<ItemsQueryResponse> => {
    const db = getDb();
    const includeSeen = payload.includeSeen ?? getShowSeen(db);
    const items = getItemsBySection(db, payload.sectionId, {
      includeSeen,
      limit: payload.limit,
      before: payload.before ?? null,
    });
    return { items };
  });

  // Mark specific items as seen
  ipc.handle('items:markSeen', async (_evt, payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse> => {
    const db = getDb();
    const changed = markItemsSeen(db, payload.itemIds);
    return { changed };
  });

  // Mark entire section as seen
  ipc.handle('sections:markSeen', async (_evt, payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse> => {
    const db = getDb();
    const changed = markSectionSeen(db, payload.sectionId);
    return { changed };
  });
}

export {};