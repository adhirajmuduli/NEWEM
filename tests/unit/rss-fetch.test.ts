import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeed } from '../../app/core/rss/fetch';
import { normalizeFeedUrl } from '../../app/core/rss/url';

function response(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('feed URL validation', () => {
  it('normalizes public HTTP(S) URLs and rejects local/private/custom protocols', () => {
    expect(normalizeFeedUrl('HTTPS://Example.com/rss.xml#frag')).toEqual({ ok: true, url: 'https://example.com/rss.xml' });
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

  it('limits redirects and validates redirected targets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response('', { status: 302, headers: { location: 'http://127.0.0.1/feed.xml' } }))
    );

    const result = await fetchFeed('https://example.com/rss.xml');

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('private_address');
  });
});