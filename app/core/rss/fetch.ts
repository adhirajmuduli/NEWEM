import { buildConditionalHeaders } from './cache';
import { normalizeFeedUrl } from './url';

export type FetchStatus = 'ok' | 'not_modified' | 'error';
export type FetchErrorCode =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'local_address'
  | 'private_address'
  | 'timeout'
  | 'too_many_redirects'
  | 'response_too_large'
  | 'http_error'
  | 'network_error';

export type FetchError = {
  code: FetchErrorCode;
  message: string;
};

export type FetchResponse = {
  status: FetchStatus;
  url: string;
  httpStatus?: number | null;
  body?: string;
  contentType?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  error?: FetchError;
};

export type FetchFeedOptions = {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function timeoutError(): DOMException | Error {
  try {
    return new DOMException('Feed fetch timed out', 'AbortError');
  } catch {
    return new Error('Feed fetch timed out');
  }
}

async function readBodyWithLimit(res: Response, maxBytes: number) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error(`Feed response exceeded ${maxBytes} bytes`), { code: 'response_too_large' });
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function redirectLocation(currentUrl: string, res: Response) {
  const location = res.headers.get('location');
  if (!location) return null;
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(timeoutError()), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFeed(url: string, opts?: FetchFeedOptions): Promise<FetchResponse> {
  const normalized = normalizeFeedUrl(url);
  if (!normalized.ok) {
    return { status: 'error', url, httpStatus: null, error: { code: normalized.code, message: normalized.message } };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const headers = buildConditionalHeaders({ etag: opts?.etag, last_modified: opts?.lastModified });

  let currentUrl = normalized.url;
  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const res = await fetchWithTimeout(currentUrl, { headers, redirect: 'manual' }, timeoutMs);
      const httpStatus = res.status;

      if (httpStatus === 304) {
        return {
          status: 'not_modified',
          url: currentUrl,
          httpStatus,
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          contentType: res.headers.get('content-type'),
        };
      }

      if (httpStatus >= 300 && httpStatus < 400) {
        const next = redirectLocation(currentUrl, res);
        if (!next || redirects === maxRedirects) {
          return {
            status: 'error',
            url: currentUrl,
            httpStatus,
            error: { code: 'too_many_redirects', message: 'Feed redirect limit exceeded or redirect was invalid' },
          };
        }
        const nextUrl = normalizeFeedUrl(next);
        if (!nextUrl.ok) {
          return { status: 'error', url: next, httpStatus, error: { code: nextUrl.code, message: nextUrl.message } };
        }
        currentUrl = nextUrl.url;
        continue;
      }

      if (httpStatus >= 200 && httpStatus < 300) {
        const body = await readBodyWithLimit(res, maxBytes);
        return {
          status: 'ok',
          url: currentUrl,
          httpStatus,
          body,
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          contentType: res.headers.get('content-type'),
        };
      }

      return {
        status: 'error',
        url: currentUrl,
        httpStatus,
        error: { code: 'http_error', message: `Feed returned HTTP ${httpStatus}` },
      };
    }

    return {
      status: 'error',
      url: currentUrl,
      httpStatus: null,
      error: { code: 'too_many_redirects', message: 'Feed redirect limit exceeded' },
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const code = (error as { code?: string } | undefined)?.code === 'response_too_large'
      ? 'response_too_large'
      : isAbort
        ? 'timeout'
        : 'network_error';
    return {
      status: 'error',
      url: currentUrl,
      httpStatus: null,
      error: { code, message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export {};