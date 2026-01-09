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
  markItemRead,
  toggleItemImportant,
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

  // Mark specific items as seen (legacy)
  ipc.handle('items:markSeen', async (_evt, payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse> => {
    const db = getDb();
    const changed = markItemsSeen(db, payload.itemIds);
    return { changed };
  });

  // Mark entire section as seen (legacy)
  ipc.handle('sections:markSeen', async (_evt, payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse> => {
    const db = getDb();
    const changed = markSectionSeen(db, payload.sectionId);
    return { changed };
  });

  // Step 9: Mark single item as read
  ipc.handle('item:markRead', async (_evt, payload: { itemId: number }) => {
    const db = getDb();
    const changed = markItemRead(db, payload.itemId);
    return { changed } as { changed: number };
  });

  // Step 9: Toggle important
  ipc.handle('item:toggleImportant', async (_evt, payload: { itemId: number }) => {
    const db = getDb();
    const is_important = toggleItemImportant(db, payload.itemId);
    return { is_important } as { is_important: 0 | 1 };
  });

  // Step 9: Virtual Important section query (all important items)
  ipc.handle('items:important', async (_evt, payload: { limit?: number; before?: string | null }) => {
    const db = getDb();
    const limit = Math.max(1, Math.min(200, payload?.limit ?? 50));
    const beforeClause = payload?.before ? 'AND i.published_at < @before' : '';
    const stmt = db.prepare(
      `SELECT i.*, f.title AS feed_title, f.site_url
       FROM items i
       JOIN feeds f ON f.id = i.feed_id
       JOIN item_state s ON s.item_id = i.id AND s.is_important = 1
       WHERE 1=1 ${beforeClause}
       ORDER BY COALESCE(i.published_at, i.created_at) DESC
       LIMIT @limit`
    );
    const items = stmt.all({ limit, before: payload?.before ?? null }) as ItemRow[];
    return { items } as { items: ItemRow[] };
  });
}

export {};