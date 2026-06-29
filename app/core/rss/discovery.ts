import { fetchFeed } from './fetch';
import { parseFeed } from './parser';
import { assertValidFeedUrl, normalizeFeedUrl } from './url';

export type FeedDiscoveryResult =
  | { status: 'ok'; inputUrl: string; feedUrl: string; title?: string | null; site_url?: string | null; discovered: boolean }
  | { status: 'error'; inputUrl: string; error: { code: string; message: string } };

function attrValue(tag: string, attr: string) {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

export function discoverFeedLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = attrValue(tag, 'rel')?.toLowerCase() || '';
    const type = attrValue(tag, 'type')?.toLowerCase() || '';
    const href = attrValue(tag, 'href');
    if (!href || !rel.includes('alternate')) continue;
    if (!['application/rss+xml', 'application/atom+xml', 'text/xml', 'application/xml'].includes(type)) continue;
    try {
      const candidate = new URL(href, baseUrl).toString();
      const normalized = normalizeFeedUrl(candidate);
      if (normalized.ok && !links.includes(normalized.url)) links.push(normalized.url);
    } catch {
      // Ignore malformed discovery candidates.
    }
  }
  return links;
}

export async function resolveFeedInput(inputUrl: string): Promise<FeedDiscoveryResult> {
  let normalizedInput: string;
  try {
    normalizedInput = assertValidFeedUrl(inputUrl);
  } catch (error) {
    return { status: 'error', inputUrl, error: { code: 'invalid_url', message: error instanceof Error ? error.message : String(error) } };
  }

  const direct = await fetchFeed(normalizedInput, { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024 });
  if (direct.status !== 'ok' || !direct.body) {
    return { status: 'error', inputUrl, error: direct.error ?? { code: 'fetch_failed', message: 'Feed fetch failed' } };
  }

  try {
    const parsed = parseFeed(direct.body);
    return { status: 'ok', inputUrl, feedUrl: normalizedInput, title: parsed.feed.title ?? null, site_url: parsed.feed.site_url ?? null, discovered: false };
  } catch {
    const candidates = discoverFeedLinks(direct.body, normalizedInput);
    for (const candidate of candidates) {
      const response = await fetchFeed(candidate, { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024 });
      if (response.status !== 'ok' || !response.body) continue;
      try {
        const parsed = parseFeed(response.body);
        return { status: 'ok', inputUrl, feedUrl: candidate, title: parsed.feed.title ?? null, site_url: parsed.feed.site_url ?? null, discovered: true };
      } catch {
        // Keep trying discovered alternates.
      }
    }
    return { status: 'error', inputUrl, error: { code: 'feed_discovery_failed', message: 'No RSS or Atom feed was discovered at this URL' } };
  }
}

export {};