export interface CacheState {
  etag?: string | null;
  last_modified?: string | null;
}

export function buildConditionalHeaders(cache: CacheState) {
  const headers: Record<string, string> = {};
  if (cache.etag) headers['If-None-Match'] = cache.etag;
  if (cache.last_modified) headers['If-Modified-Since'] = cache.last_modified;
  return headers;
}

export {};
