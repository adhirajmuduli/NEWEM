import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverFeedLinks, resolveFeedInput } from '../../app/core/rss/discovery';

afterEach(() => vi.restoreAllMocks());

describe('RSS and Atom autodiscovery', () => {
  it('resolves public relative RSS/Atom alternates and excludes JSON Feed links', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
      <link rel="alternate" type="application/atom+xml" href="https://feeds.example.org/atom.xml">
      <link rel="alternate" type="application/feed+json" href="/feed.json">
      <link rel="alternate" type="application/rss+xml" href="http://localhost/private.xml">
    `;
    expect(discoverFeedLinks(html, 'https://example.com/news')).toEqual([
      'https://example.com/rss.xml',
      'https://feeds.example.org/atom.xml',
    ]);
  });

  it('tests discovered candidates and returns the canonical RSS URL', async () => {
    const html = '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head></html>';
    const rss = '<rss version="2.0"><channel><title>Example News</title><link>https://example.com</link><item><title>One</title><link>https://example.com/one</link></item></channel></rss>';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(rss, { status: 200, headers: { 'content-type': 'application/rss+xml' } })));

    await expect(resolveFeedInput('https://example.com')).resolves.toMatchObject({
      status: 'ok',
      feedUrl: 'https://example.com/rss.xml',
      title: 'Example News',
      discovered: true,
    });
  });
});