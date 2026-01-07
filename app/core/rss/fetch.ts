export type FetchStatus = 'ok' | 'not_modified' | 'error';

export type FetchResponse = {
  status: FetchStatus;
  body?: string;
  etag?: string | null;
  lastModified?: string | null;
};

const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchFeed(
  url: string,
  opts?: { etag?: string | null; lastModified?: string | null; timeoutMs?: number }
): Promise<FetchResponse> {
  const headers: Record<string, string> = {};
  if (opts?.etag) headers['If-None-Match'] = opts.etag;
  if (opts?.lastModified) headers['If-Modified-Since'] = opts.lastModified;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: controller.signal as any });
    clearTimeout(t);
    if (res.status === 304) {
      return {
        status: 'not_modified',
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
      };
    }
    if (res.status >= 200 && res.status < 300) {
      const body = await res.text();
      return {
        status: 'ok',
        body,
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
      };
    }
    return { status: 'error' };
  } catch {
    clearTimeout(t);
    return { status: 'error' };
  }
}