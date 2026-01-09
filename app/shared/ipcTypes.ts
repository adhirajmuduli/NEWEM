// Shared IPC request/response types and the preload API surface

export type SyncTriggerPayload = { feedId?: number };
export type SyncTriggerResponse = { status: 'ok'; triggered: number };

export type ItemWire = {
  id: number;
  feed_id: number;
  guid?: string | null;
  link: string;
  title?: string | null;
  description?: string | null;
  published_at?: string | null;
  dedupe_key: string;
  seen_at?: string | null;
  created_at: string;
  feed_title?: string | null;
  site_url?: string | null;
  is_read?: 0 | 1;
  is_important?: 0 | 1;
};

export type ItemsQueryPayload = {
  sectionId: number;
  limit?: number;
  before?: string | null;
  includeSeen?: boolean;
};
export type ItemsQueryResponse = { items: ItemWire[] };

export type MarkItemsSeenPayload = { itemIds: number[] };
export type MarkItemsSeenResponse = { changed: number };

export type MarkSectionSeenPayload = { sectionId: number };
export type MarkSectionSeenResponse = { changed: number };

// Step 9: item read / important
export type MarkItemReadPayload = { itemId: number };
export type MarkItemReadResponse = { changed: number };

export type ToggleItemImportantPayload = { itemId: number };
export type ToggleItemImportantResponse = { is_important: 0 | 1 };

// Virtual "Important" list query (all important items)
export type ImportantItemsQueryPayload = {
  limit?: number;
  before?: string | null;
};
export type ImportantItemsQueryResponse = { items: ItemWire[] };

export interface PreloadApi {
  syncTrigger(payload?: SyncTriggerPayload): Promise<SyncTriggerResponse>;
  queryItems(payload: ItemsQueryPayload): Promise<ItemsQueryResponse>;
  markItemsSeen(payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse>;
  markSectionSeen(payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse>;
  // Step 9
  markItemRead(payload: MarkItemReadPayload): Promise<MarkItemReadResponse>;
  toggleItemImportant(payload: ToggleItemImportantPayload): Promise<ToggleItemImportantResponse>;
  queryImportant(payload?: ImportantItemsQueryPayload): Promise<ImportantItemsQueryResponse>;
}
