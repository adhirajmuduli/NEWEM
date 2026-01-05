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

export interface PreloadApi {
  syncTrigger(payload?: SyncTriggerPayload): Promise<SyncTriggerResponse>;
  queryItems(payload: ItemsQueryPayload): Promise<ItemsQueryResponse>;
  markItemsSeen(payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse>;
  markSectionSeen(payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse>;
}
