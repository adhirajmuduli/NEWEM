export type FeedUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; code: 'invalid_url' | 'unsupported_protocol' | 'local_address' | 'private_address'; message: string };

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isLocalOrPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  return isPrivateIpv4(host);
}

export function normalizeFeedUrl(input: string): FeedUrlValidationResult {
  const raw = input.trim();
  if (!raw) return { ok: false, code: 'invalid_url', message: 'Feed URL is empty' };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, code: 'invalid_url', message: 'Feed URL is not a valid absolute URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'unsupported_protocol', message: `Unsupported feed URL protocol: ${parsed.protocol}` };
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    return { ok: false, code: 'private_address', message: 'Feed URL points to a local or private address' };
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.username = '';
  parsed.password = '';
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return { ok: true, url: parsed.toString() };
}

export function assertValidFeedUrl(input: string) {
  const result = normalizeFeedUrl(input);
  if (!result.ok) throw new Error(result.message);
  return result.url;
}

export {};