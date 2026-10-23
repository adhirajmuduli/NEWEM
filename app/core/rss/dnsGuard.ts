import { lookup as dnsLookup } from 'node:dns/promises';
import { isAddressLiteral, isPrivateAddress } from './url';

export type HostLookup = (hostname: string) => Promise<string[]>;

export type HostResolution =
  | { ok: true; addresses: string[] }
  | { ok: false; code: 'private_address' | 'network_error'; message: string };

const DEFAULT_LOOKUP_TIMEOUT_MS = 10_000;

const defaultHostLookup: HostLookup = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

let hostLookupOverride: HostLookup | null = null;

export function setHostLookupOverride(lookup: HostLookup | null) {
  hostLookupOverride = lookup;
}

export async function resolvePublicHost(
  hostname: string,
  options: { lookup?: HostLookup; timeoutMs?: number } = {}
): Promise<HostResolution> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return { ok: false, code: 'network_error', message: 'Feed host is empty' };

  if (isAddressLiteral(host)) {
    return isPrivateAddress(host)
      ? { ok: false, code: 'private_address', message: `Feed host ${host} is a non-public address` }
      : { ok: true, addresses: [host] };
  }

  const lookup = options.lookup ?? hostLookupOverride ?? defaultHostLookup;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS;

  try {
    const addresses = await Promise.race([
      lookup(host),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`DNS lookup timed out after ${timeoutMs}ms`)), timeoutMs);
        if (typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
      }),
    ]);
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return { ok: false, code: 'network_error', message: `Host ${host} did not resolve to any address` };
    }
    const offender = addresses.find((address) => isPrivateAddress(address));
    if (offender) {
      return { ok: false, code: 'private_address', message: `Host ${host} resolves to the non-public address ${offender}` };
    }
    return { ok: true, addresses };
  } catch (error) {
    return {
      ok: false,
      code: 'network_error',
      message: `DNS lookup failed for ${host}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export {};
