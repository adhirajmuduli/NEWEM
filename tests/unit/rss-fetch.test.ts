import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFeed } from '../../app/core/rss/fetch';
import { normalizeFeedUrl } from '../../app/core/rss/url';
import { setHostLookupOverride } from '../../app/core/rss/dnsGuard';

function response(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

beforeEach(() => {
  setHostLookupOverride(async () => ['203.0.113.10']);
});

afterEach(() => {
  setHostLookupOverride(null);
  vi.restoreAllMocks();
});

describe('feed URL validation', () => {
  it('normalizes public HTTP(S) URLs and rejects local/private/custom protocols', () => {
    expect(normalizeFeedUrl('HTTPS://Example.com/rss.xml#frag')).toEqual({ ok: true, url: 'https://example.com/rss.xml' });
    expect(normalizeFeedUrl('https://example.com/feed/')).toEqual({ ok: true, url: 'https://example.com/feed' });
    expect(normalizeFeedUrl('https://example.com/feed/', { preserveTrailingSlash: true }))
      .toEqual({ ok: true, url: 'https://example.com/feed/' });
    expect(normalizeFeedUrl('file:///tmp/feed.xml')).toMatchObject({ ok: false, code: 'unsupported_protocol' });
    expect(normalizeFeedUrl('http://localhost/rss.xml')).toMatchObject({ ok: false, code: 'private_address' });
    expect(normalizeFeedUrl('http://192.168.1.2/rss.xml')).toMatchObject({ ok: false, code: 'private_address' });
    expect(normalizeFeedUrl('readit://feed')).toMatchObject({ ok: false, code: 'unsupported_protocol' });
  });
});

describe('fetchFeed', () => {
  it('returns 200 OK bodies with conditional request headers', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)['If-None-Match']).toBe('abc');
      expect((init.headers as Record<string, string>)['If-Modified-Since']).toBe('yesterday');
      expect((init.headers as Record<string, string>).Accept).toContain('application/rss+xml');
      expect((init.headers as Record<string, string>)['User-Agent']).toContain('READIT');
      return response('<rss><channel><title>T</title></channel></rss>', {
        status: 200,
        headers: { etag: 'next', 'last-modified': 'today', 'content-type': 'text/plain' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFeed('https://example.com/rss.xml', { etag: 'abc', lastModified: 'yesterday' });

    expect(result).toMatchObject({ status: 'ok', httpStatus: 200, etag: 'next', lastModified: 'today' });
    expect(result.body).toContain('<rss>');
  });

  it('returns 304 Not Modified without reading a body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 304, headers: { etag: 'same' } })));

    const result = await fetchFeed('https://example.com/rss.xml');

    expect(result).toMatchObject({ status: 'not_modified', httpStatus: 304, etag: 'same' });
    expect(result.body).toBeUndefined();
  });

  it('returns structured timeout errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
      )
    );

    const result = await fetchFeed('https://example.com/rss.xml', { timeoutMs: 1 });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('timeout');
  });

  it('caps response size and reports HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('too large', { status: 200 })));
    const tooLarge = await fetchFeed('https://example.com/rss.xml', { maxBytes: 3 });
    expect(tooLarge).toMatchObject({ status: 'error', error: { code: 'response_too_large' } });

    vi.stubGlobal('fetch', vi.fn(async () => response('nope', { status: 503 })));
    const httpError = await fetchFeed('https://example.com/rss.xml');
    expect(httpError).toMatchObject({ status: 'error', httpStatus: 503, error: { code: 'http_error' } });
  });

  it('follows a trailing-slash redirect without normalizing it into a loop', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://example.com/feed') {
        return response('', { status: 301, headers: { location: '/feed/' } });
      }
      return response('<rss><channel><title>T</title></channel></rss>', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFeed('https://example.com/feed');

    expect(result).toMatchObject({ status: 'ok', url: 'https://example.com/feed/' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits redirects and validates redirected targets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response('', { status: 302, headers: { location: 'http://127.0.0.1/feed.xml' } }))
    );

    const result = await fetchFeed('https://example.com/rss.xml');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('private_address');
  });

  it('refuses to connect when the host resolves to a private address', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setHostLookupOverride(async () => ['93.184.216.34', '192.168.0.10']);

    const result = await fetchFeed('https://rebind.example.com/feed.xml');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('private_address');
    expect(result.error?.message).toContain('192.168.0.10');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revalidates resolution on every redirect hop', async () => {
    let hops = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        hops += 1;
        if (hops === 1) return response('', { status: 302, headers: { location: 'https://hop.example.com/feed.xml' } });
        return response('<rss><channel><title>T</title></channel></rss>', { status: 200 });
      })
    );
    const lookup = vi.fn(async (hostname: string) => {
      if (hostname === 'hop.example.com') return ['10.0.0.7'];
      return ['203.0.113.10'];
    });
    setHostLookupOverride(lookup);

    const result = await fetchFeed('https://example.com/feed.xml');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('private_address');
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});