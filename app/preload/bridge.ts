import { validateSyncCompletedWire, validateSyncProgressWire } from './validators';
import type {
  ExternalOpenPayload,
  FeedAddToSectionPayload,
  FeedRemoveFromSectionPayload,
  FeedTestPayload,
  FeedUpdatePayload,
  ImportantItemsQueryPayload,
  ImportantItemsQueryResponse,
  ItemsQueryPayload,
  LayoutSetPayload,
  MarkItemReadPayload,
  MarkItemReadResponse,
  MarkItemsSeenPayload,
  MarkSectionSeenPayload,
  OpmlImportPayload,
  SyncProgressWire,
  SyncCompletedWire,
  PreloadApi,
  PRELOAD_API_VERSION,
  SectionCreatePayload,
  SectionDeletePayload,
  SectionReorderPayload,
  SectionUpdatePayload,
  SyncTriggerPayload,
  ToggleItemImportantPayload,
  ToggleItemImportantResponse,
} from '../shared/ipcTypes';


declare const require: any;

const electron = (() => {
  try {
    return require('electron');
  } catch {
    return null;
  }
})();

const ipcRenderer = electron?.ipcRenderer;
const contextBridge = electron?.contextBridge;

if (!ipcRenderer) {
  throw new Error('ipcRenderer unavailable in preload');
}

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload ?? {});
}

const API_VERSION: typeof PRELOAD_API_VERSION = 1;

const api: PreloadApi = {
  version: API_VERSION as typeof PRELOAD_API_VERSION,
  listSections: () => invoke('sections:list'),
  createSection: (payload: SectionCreatePayload) => invoke('sections:create', payload),
  updateSection: (payload: SectionUpdatePayload) => invoke('sections:update', payload),
  deleteSection: (payload: SectionDeletePayload) => invoke('sections:delete', payload),
  reorderSections: (payload: SectionReorderPayload) => invoke('sections:reorder', payload),
  addFeedToSection: (payload: FeedAddToSectionPayload) => invoke('feeds:addToSection', payload),
  updateFeed: (payload: FeedUpdatePayload) => invoke('feeds:update', payload),
  removeFeedFromSection: (payload: FeedRemoveFromSectionPayload) => invoke('feeds:removeFromSection', payload),
  testFeed: (payload: FeedTestPayload) => invoke('feeds:test', payload),
  syncTrigger: (payload?: SyncTriggerPayload) => invoke('sync:trigger', payload ?? {}),
  onSyncProgress: (listener: (progress: SyncProgressWire) => void) => {
    const wrapped = (_event: unknown, progress: unknown) => listener(validateSyncProgressWire(progress));
    ipcRenderer.on('sync:progress', wrapped);
    return () => ipcRenderer.removeListener('sync:progress', wrapped);
  },
  onSyncCompleted: (listener: (event: SyncCompletedWire) => void) => {
    const wrapped = (_event: unknown, value: unknown) => listener(validateSyncCompletedWire(value));
    ipcRenderer.on('sync:completed', wrapped);
    return () => ipcRenderer.removeListener('sync:completed', wrapped);
  },
  queryItems: (payload: ItemsQueryPayload) => invoke('items:query', payload),
  markItemsSeen: (payload: MarkItemsSeenPayload) => invoke('items:markSeen', payload),
  markSectionSeen: (payload: MarkSectionSeenPayload) => invoke('sections:markSeen', payload),
  markItemRead(payload: MarkItemReadPayload): Promise<MarkItemReadResponse> {
    return invoke('items:markRead', payload);
  },
  toggleItemImportant(payload: ToggleItemImportantPayload): Promise<ToggleItemImportantResponse> {
    return invoke('items:toggleImportant', payload);
  },
  queryImportant(payload?: ImportantItemsQueryPayload): Promise<ImportantItemsQueryResponse> {
    return invoke('items:important', payload ?? {});
  },
  getLayout: () => invoke('layout:get'),
  setLayout: (payload: LayoutSetPayload) => invoke('layout:set', payload),
  openExternal: (payload: ExternalOpenPayload) => invoke('shell:openExternal', payload),
  exportOpml: () => invoke('portability:exportOpml'),
  importOpml: (payload: OpmlImportPayload) => invoke('portability:importOpml', payload),
  exportBackup: () => invoke('portability:backup'),
  exportDiagnostics: () => invoke('diagnostics:export'),
  closeApplication: () => invoke('application:quit'),
};

if (contextBridge?.exposeInMainWorld) {
  contextBridge.exposeInMainWorld('readit', api);
} else {
  (globalThis as any).window = (globalThis as any).window || globalThis;
  (globalThis as any).window.readit = api;
}

declare global {
  interface Window {
    readit: PreloadApi;
  }
}

export {};
