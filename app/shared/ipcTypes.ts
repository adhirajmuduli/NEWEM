import type { ColorSchemeId } from './colorSchemes';

export const PRELOAD_API_VERSION = 1 as const;

export type ApiEnvelope<T> = { apiVersion: typeof PRELOAD_API_VERSION; data: T };

export type FeedWire = {
  id: number;
  url: string;
  title?: string | null;
  site_url?: string | null;
  last_fetched_at?: string | null;
  last_error?: string | null;
  fetch_interval_minutes?: number | null;
  is_enabled: 0 | 1;
  is_muted: 0 | 1;
  item_count: number;
  unread_count: number;
};

export type SectionWire = {
  id: number;
  key: string;
  name: string;
  position_index: number;
  feeds: FeedWire[];
};

export type SyncTriggerPayload = { feedId?: number; sectionId?: number };
export type SyncItemResult = {
  status: 'ok' | 'not_modified' | 'error';
  feedId?: number;
  url: string;
  normalizedUrl: string;
  httpStatus?: number | null;
  newItems: number;
  error?: { code: string; message: string };
};
export type SyncProgressWire = { scope: 'feed' | 'section' | 'all'; sectionId?: number; completed: number; total: number; percent: number; feedId?: number };
export type SyncCompletedWire = { source: 'scheduler'; feedId: number; sectionIds: number[]; status: 'ok' | 'not_modified' | 'error'; newItems: number };

export type SyncTriggerResponse = {
  status: 'ok';
  scope: 'feed' | 'section' | 'all';
  requested: number;
  triggered: number;
  ok: number;
  notModified: number;
  errors: number;
  newItems: number;
  results: SyncItemResult[];
};

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

export type SectionAppearanceWire = {
  mode: 'solid' | 'gradient' | 'image';
  solid?: string;
  gradientFrom?: string;
  gradientTo?: string;
  imageDataUrl?: string;
};

export type LayoutModeWire = 'stack' | 'columns' | 'mosaic' | 'focus';

export type LayoutWire = {
  mode?: LayoutModeWire;
  theme?: ColorSchemeId;
  panels: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  appearance?: Record<string, SectionAppearanceWire>;
  dayWindows?: Record<string, number | null>;
};

export type SectionsListResponse = { sections: SectionWire[] };
export type SectionCreatePayload = { name: string; key?: string; position?: number };
export type SectionUpdatePayload = { sectionId: number; name?: string; position?: number };
export type SectionDeletePayload = { sectionId: number };
export type SectionReorderPayload = { sectionIds: number[] };
export type SectionMutationResponse = { section?: SectionWire; changed: number };
export type SectionReorderResponse = { changed: number };

export type FeedAddToSectionPayload = { sectionId: number; url: string; fetchIntervalMinutes?: number; enabled?: boolean };
export type FeedUpdatePayload = { feedId: number; enabled?: boolean; muted?: boolean; fetchIntervalMinutes?: number | null };
export type FeedRemoveFromSectionPayload = { sectionId: number; feedId: number };
export type FeedTestPayload = { url: string };
export type FeedMutationResponse = { feed?: FeedWire; changed: number };
export type FeedTestResponse = { status: 'ok' | 'error'; feedUrl?: string; discovered?: boolean; title?: string | null; site_url?: string | null; error?: { code: string; message: string } };
export type ApplicationQuitResponse = { closing: true };

export type ItemsQueryPayload = { sectionId: number; all?: boolean; limit?: number; before?: string | null; includeSeen?: boolean; query?: string; feedId?: number; importantOnly?: boolean; unreadOnly?: boolean; publishedAfter?: string | null; publishedBefore?: string | null };
export type ItemsQueryResponse = { items: ItemWire[] };
export type MarkItemsSeenPayload = { itemIds: number[] };
export type MarkItemsSeenResponse = { changed: number };
export type MarkSectionSeenPayload = { sectionId: number };
export type MarkSectionSeenResponse = { changed: number };
export type MarkItemReadPayload = { itemId: number };
export type MarkItemReadResponse = { changed: number };
export type ToggleItemImportantPayload = { itemId: number };
export type ToggleItemImportantResponse = { is_important: 0 | 1 };
export type ImportantItemsQueryPayload = { limit?: number; before?: string | null };
export type ImportantItemsQueryResponse = { items: ItemWire[] };
export type ExternalOpenPayload = { url: string };
export type ExternalOpenResponse = { opened: boolean; error?: { code: string; message: string } };
export type LayoutGetResponse = { layout: LayoutWire };
export type LayoutSetPayload = { layout: LayoutWire };
export type LayoutSetResponse = { layout: LayoutWire };
export type OpmlExportResponse = { opml: string };
export type OpmlImportPayload = { opml: string; sectionId?: number };
export type OpmlImportResponse = { imported: number; skipped: number };
export type BackupExportResponse = { filePath: string };
export type DiagnosticsExportResponse = { filePath: string; entries: number };

export interface PreloadApi {
  readonly version: typeof PRELOAD_API_VERSION;
  listSections(): Promise<SectionsListResponse>;
  createSection(payload: SectionCreatePayload): Promise<SectionMutationResponse>;
  updateSection(payload: SectionUpdatePayload): Promise<SectionMutationResponse>;
  deleteSection(payload: SectionDeletePayload): Promise<SectionMutationResponse>;
  reorderSections(payload: SectionReorderPayload): Promise<SectionReorderResponse>;
  addFeedToSection(payload: FeedAddToSectionPayload): Promise<FeedMutationResponse>;
  updateFeed(payload: FeedUpdatePayload): Promise<FeedMutationResponse>;
  removeFeedFromSection(payload: FeedRemoveFromSectionPayload): Promise<FeedMutationResponse>;
  testFeed(payload: FeedTestPayload): Promise<FeedTestResponse>;
  syncTrigger(payload?: SyncTriggerPayload): Promise<SyncTriggerResponse>;
  onSyncProgress(listener: (progress: SyncProgressWire) => void): () => void;
  onSyncCompleted?(listener: (event: SyncCompletedWire) => void): () => void;
  queryItems(payload: ItemsQueryPayload): Promise<ItemsQueryResponse>;
  markItemsSeen(payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse>;
  markSectionSeen(payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse>;
  markItemRead(payload: MarkItemReadPayload): Promise<MarkItemReadResponse>;
  toggleItemImportant(payload: ToggleItemImportantPayload): Promise<ToggleItemImportantResponse>;
  queryImportant(payload?: ImportantItemsQueryPayload): Promise<ImportantItemsQueryResponse>;
  getLayout(): Promise<LayoutGetResponse>;
  setLayout(payload: LayoutSetPayload): Promise<LayoutSetResponse>;
  openExternal(payload: ExternalOpenPayload): Promise<ExternalOpenResponse>;
  exportOpml(): Promise<OpmlExportResponse>;
  importOpml(payload: OpmlImportPayload): Promise<OpmlImportResponse>;
  exportBackup(): Promise<BackupExportResponse>;
  exportDiagnostics(): Promise<DiagnosticsExportResponse>;
  closeApplication?(): Promise<ApplicationQuitResponse>;
}
