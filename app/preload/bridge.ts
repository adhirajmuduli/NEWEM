// app/preload/bridge.ts

import type {
  PreloadApi,
  SyncTriggerPayload,
  ItemsQueryPayload,
  MarkItemsSeenPayload,
  MarkSectionSeenPayload,
  MarkItemReadPayload,
  MarkItemReadResponse,
  ToggleItemImportantPayload,
  ToggleItemImportantResponse,
  ImportantItemsQueryPayload,
  ImportantItemsQueryResponse,
} from '../shared/ipcTypes';

declare const require: any;

// Dynamically require Electron so TS build does not depend on Electron types
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

const api: PreloadApi = {
  syncTrigger(payload?: SyncTriggerPayload) {
    return ipcRenderer.invoke('sync:trigger', payload ?? {});
  },

  queryItems(payload: ItemsQueryPayload) {
    return ipcRenderer.invoke('items:query', payload);
  },

  markItemsSeen(payload: MarkItemsSeenPayload) {
    return ipcRenderer.invoke('items:markSeen', payload);
  },

  markSectionSeen(payload: MarkSectionSeenPayload) {
    return ipcRenderer.invoke('sections:markSeen', payload);
  },
  // Step 9
  markItemRead(payload: MarkItemReadPayload): Promise<MarkItemReadResponse> {
    return ipcRenderer.invoke('item:markRead', payload);
  },
  toggleItemImportant(payload: ToggleItemImportantPayload): Promise<ToggleItemImportantResponse> {
    return ipcRenderer.invoke('item:toggleImportant', payload);
  },
  queryImportant(payload?: ImportantItemsQueryPayload): Promise<ImportantItemsQueryResponse> {
    return ipcRenderer.invoke('items:important', payload ?? {});
  },
};

if (contextBridge?.exposeInMainWorld) {
  contextBridge.exposeInMainWorld('readit', api);
} else {
  // Fallback (tests / non-isolated env)
  (globalThis as any).window = (globalThis as any).window || globalThis;
  (globalThis as any).window.readit = api;
}

declare global {
  interface Window {
    readit: PreloadApi;
  }
}

export {};
