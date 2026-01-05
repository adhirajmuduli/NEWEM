export interface CacheState {
  etag?: string | null;
  last_modified?: string | null;
}

export function buildConditionalHeaders(cache: CacheState) {
  const headers: Record<string, string> = {
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
    'User-Agent': 'READIT/0.1 (+local-only)'
  };
  if (cache.etag) headers['If-None-Match'] = cache.etag;
  if (cache.last_modified) headers['If-Modified-Since'] = cache.last_modified;
  return headers;
}

export function extractCacheFromHeaders(headers: Headers | Map<string, string>) {
  const get = (k: string) =>
    headers instanceof Map ? headers.get(k.toLowerCase()) : headers.get(k) ?? headers.get(k.toLowerCase());
  return {
    etag: get('etag') || undefined,
    last_modified: get('last-modified') || undefined,
  } as CacheState;
}

export {};
