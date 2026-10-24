export type FeedUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; code: 'invalid_url' | 'unsupported_protocol' | 'local_address' | 'private_address'; message: string };

export function isAddressLiteral(address: string) {
  const host = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (host.includes(':')) return true;
  const parts = host.split('.');
  return parts.length === 4 && parts.every((part) => {
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function isPrivateAddress(address: string) {
  const host = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    const ipv4Mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (ipv4Mapped) return isPrivateIpv4(ipv4Mapped[1]);
    const firstGroup = host.split(':')[0];
    if (/^f[cd]/.test(firstGroup)) return true;
    if (/^fe[89ab]/.test(firstGroup)) return true;
    return false;
  }
  return isPrivateIpv4(host);
}

function isLocalOrPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (isAddressLiteral(host)) return isPrivateAddress(host);
  return false;
}

export function normalizeFeedUrl(
  input: string,
  options: { preserveTrailingSlash?: boolean } = {}
): FeedUrlValidationResult {
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
  if (!options.preserveTrailingSlash && parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
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