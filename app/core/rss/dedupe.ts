import crypto from 'crypto';

export function canonicalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    // strip common tracking params
    const paramsToDrop = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
    ]);
    for (const k of Array.from(u.searchParams.keys())) {
      if (paramsToDrop.has(k)) u.searchParams.delete(k);
    }
    let pathname = u.pathname;
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    u.pathname = pathname;
    return u.toString();
  } catch {
    return input.trim();
  }
}

export function normalizeTitle(title?: string | null): string {
  return (title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeDedupeKey(args: { guid?: string | null; link: string; title?: string | null }): string {
  if (args.guid && args.guid.trim().length > 0) return `guid:${args.guid.trim()}`;
  const link = canonicalizeUrl(args.link);
  const title = normalizeTitle(args.title);
  return `lt:${sha256(link + '|' + title)}`;
}

export {};
