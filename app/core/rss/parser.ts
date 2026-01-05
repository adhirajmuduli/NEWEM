import { XMLParser } from 'fast-xml-parser';

export interface ParsedItem {
  guid?: string | null;
  link: string;
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  sourceTitle?: string | null;
}

export interface ParsedFeed {
  feed: { title?: string | null; site_url?: string | null };
  items: ParsedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
});

function stripHtml(input?: string | null): string | null {
  if (!input) return input ?? null;
  return input.replace(/<[^>]*>/g, '').trim();
}

function firstString(val: any): string | undefined {
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

function pickAtomLink(entry: any): string | undefined {
  const links = entry.link;
  if (!links) return undefined;
  if (Array.isArray(links)) {
    const alt = links.find((l) => l.rel === 'alternate' && l.href);
    return (alt && alt.href) || links.find((l) => l.href)?.href;
  }
  if (typeof links === 'object') return links.href;
  return undefined;
}

function pickRssLink(item: any): string | undefined {
  if (typeof item.link === 'string') return item.link;
  if (item.link && typeof item.link === 'object' && item.link.href) return item.link.href;
  return undefined;
}

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);
  // RSS 2.0
  if (doc?.rss?.channel) {
    const ch = doc.rss.channel;
    const channel = Array.isArray(ch) ? ch[0] : ch;
    const site_url = firstString(channel.link);
    const title = firstString(channel.title);
    const itemsArr = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    const items: ParsedItem[] = itemsArr
      .map((it: any) => {
        const link = pickRssLink(it) || '';
        if (!link) return null;
        return {
          guid: firstString(it.guid) || undefined,
          link,
          title: firstString(it.title) || undefined,
          description: stripHtml(firstString(it.description) || firstString(it.summary) || undefined) || undefined,
          publishedAt: firstString(it.pubDate) || undefined,
          sourceTitle: title || undefined,
        } as ParsedItem;
      })
      .filter(Boolean) as ParsedItem[];
    return { feed: { title, site_url }, items };
  }
  // Atom
  if (doc?.feed) {
    const feed = doc.feed;
    const site_url = pickAtomLink(feed);
    const title = firstString(feed.title);
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    const items: ParsedItem[] = entries
      .map((e: any) => {
        const link = pickAtomLink(e) || '';
        if (!link) return null;
        return {
          guid: firstString(e.id) || undefined,
          link,
          title: firstString(e.title) || undefined,
          description: stripHtml(firstString(e.summary) || firstString(e.content) || undefined) || undefined,
          publishedAt: firstString(e.published) || firstString(e.updated) || undefined,
          sourceTitle: title || undefined,
        } as ParsedItem;
      })
      .filter(Boolean) as ParsedItem[];
    return { feed: { title, site_url }, items };
  }
  // Fallback: return no items
  return { feed: { title: undefined, site_url: undefined }, items: [] };
}

export {};
