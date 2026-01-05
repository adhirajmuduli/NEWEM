import type {
  PreloadApi,
  SyncTriggerPayload,
  SyncTriggerResponse,
  ItemsQueryPayload,
  ItemsQueryResponse,
  MarkItemsSeenPayload,
  MarkItemsSeenResponse,
  MarkSectionSeenPayload,
  MarkSectionSeenResponse,
} from '../../shared/ipcTypes';

function getApi(): PreloadApi {
  const api = (window as any).readit as PreloadApi | undefined;
  if (!api) throw new Error('Preload API is not available on window.readit');
  return api;
}

export async function syncTrigger(payload?: SyncTriggerPayload): Promise<SyncTriggerResponse> {
  return getApi().syncTrigger(payload);
}

export async function queryItems(payload: ItemsQueryPayload): Promise<ItemsQueryResponse> {
  return getApi().queryItems(payload);
}

export async function markItemsSeen(payload: MarkItemsSeenPayload): Promise<MarkItemsSeenResponse> {
  return getApi().markItemsSeen(payload);
}

export async function markSectionSeen(payload: MarkSectionSeenPayload): Promise<MarkSectionSeenResponse> {
  return getApi().markSectionSeen(payload);
}
