import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicHost, setHostLookupOverride, type HostLookup } from '../../app/core/rss/dnsGuard';

const addresses = (values: string[]): HostLookup => vi.fn(async () => values);

describe('DNS resolution guard', () => {
  beforeEach(() => {
    setHostLookupOverride(null);
  });

  afterEach(() => {
    setHostLookupOverride(null);
  });

  it('accepts hostnames that resolve only to public addresses', async () => {
    const result = await resolvePublicHost('feeds.example.com', {
      lookup: addresses(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']),
    });
    expect(result).toMatchObject({ ok: true, addresses: ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'] });
  });

  it('rejects hostnames with any private IPv4 record', async () => {
    const result = await resolvePublicHost('rebind.example.com', {
      lookup: addresses(['93.184.216.34', '192.168.1.10']),
    });
    expect(result).toMatchObject({ ok: false, code: 'private_address' });
  });

  it('rejects loopback, ULA, link-local, IPv4-mapped, and CGNAT records', async () => {
    for (const address of ['127.0.0.1', '10.0.0.5', '172.16.2.3', '192.168.0.1', '100.64.0.9', '169.254.1.1',
      '::1', 'fd12::1', 'fc00::5', 'fe80::1', 'fe90::1', '::ffff:10.0.0.5']) {
      const result = await resolvePublicHost('rebind.example.com', { lookup: addresses([address]) });
      expect(result, address).toMatchObject({ ok: false, code: 'private_address' });
    }
  });

  it('accepts public IPv6 records', async () => {
    const result = await resolvePublicHost('v6.example.com', {
      lookup: addresses(['2606:2800:220:1:248:1893:25c8:1946']),
    });
    expect(result.ok).toBe(true);
  });

  it('validates IP literal hosts without invoking DNS', async () => {
    const spy = addresses(['93.184.216.34']);
    const publicLiteral = await resolvePublicHost('8.8.8.8', { lookup: spy });
    expect(publicLiteral).toMatchObject({ ok: true, addresses: ['8.8.8.8'] });
    const privateLiteral = await resolvePublicHost('10.1.2.3', { lookup: spy });
    expect(privateLiteral).toMatchObject({ ok: false, code: 'private_address' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps lookup failures to network errors', async () => {
    const failing: HostLookup = async () => {
      throw new Error('ENOTFOUND');
    };
    const result = await resolvePublicHost('dead.example.com', { lookup: failing });
    expect(result).toMatchObject({ ok: false, code: 'network_error' });
  });

  it('bounds lookups with the configured timeout', async () => {
    const hanging: HostLookup = () => new Promise(() => {});
    const result = await resolvePublicHost('slow.example.com', { lookup: hanging, timeoutMs: 10 });
    expect(result).toMatchObject({ ok: false, code: 'network_error' });
  });

  it('honors the module-level lookup override used by test harnesses', async () => {
    setHostLookupOverride(async () => ['203.0.113.10']);
    const result = await resolvePublicHost('override.example.com');
    expect(result).toMatchObject({ ok: true, addresses: ['203.0.113.10'] });
  });
});
