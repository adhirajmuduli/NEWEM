import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initDb } from '../../app/core/storage/db';
import { registerIpcHandlers } from '../../app/main/ipc';
import { validateSyncCompletedWire, validateSyncProgressWire } from '../../app/preload/validators';

type Handler = (_evt: unknown, payload?: unknown) => Promise<unknown>;
const tempRoots: string[] = [];

function setupHandlers() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readit-security-ipc-'));
  tempRoots.push(dir);
  initDb(dir);
  const map = new Map<string, Handler>();
  registerIpcHandlers({ handle: (channel, listener) => map.set(channel, listener as Handler) });
  return map;
}

afterEach(() => {
  closeDb();
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('validated IPC handlers', () => {
  it('rejects unknown fields and invalid payloads before touching handlers', async () => {
    const handlers = setupHandlers();
    await expect(handlers.get('items:query')!(null, { sectionId: 1, injected: true })).rejects.toThrow(/not allowed/);
    await expect(handlers.get('sections:create')!(null, { name: '' })).rejects.toThrow(/too short/);
    await expect(handlers.get('feeds:addToSection')!(null, { sectionId: 1, url: 'file:///tmp/rss.xml' })).rejects.toThrow(/Unsupported/);
    await expect(handlers.get('portability:importOpml')!(null, { opml: '<opml />', injected: true })).rejects.toThrow(/not allowed/);
    await expect(handlers.get('items:query')!(null, { sectionId: -1, query: 'x'.repeat(201) })).rejects.toThrow(/too long/);
    await expect(handlers.get('layout:set')!(null, { layout: { panels: [{ id: 'x', x: 0, y: 0, w: 0, h: 1 }] } })).rejects.toThrow(/must be >= 1/);
    await expect(handlers.get('layout:set')!(null, { layout: { theme: 'untrusted', panels: [] } })).rejects.toThrow(/theme is invalid/);
    await expect(handlers.get('layout:set')!(null, { layout: { panels: [], dayWindows: { security: 0 } } })).rejects.toThrow(/must be >= 1/);
  });

  it('accepts valid section and layout requests', async () => {
    const handlers = setupHandlers();
    const created = await handlers.get('sections:create')!(null, { name: 'Security', key: 'security' }) as any;
    expect(created.changed).toBe(1);
    const layout = await handlers.get('layout:set')!(null, { layout: { theme: 'readit', panels: [{ id: 'security', x: 0, y: 0, w: 3, h: 2 }], dayWindows: { security: 7 } } }) as any;
    expect(layout.layout).toMatchObject({ theme: 'readit', panels: [{ id: 'security', w: 3 }], dayWindows: { security: 7 } });
    const allItems = await handlers.get('items:query')!(null, { sectionId: -1, all: true, includeSeen: true }) as any;
    expect(allItems.items).toEqual([]);
  });

  it('closes only the requesting Electron window through validated IPC', async () => {
    const handlers = setupHandlers();
    const close = vi.fn();
    const event = { sender: { getOwnerBrowserWindow: () => ({ close }) } };
    await expect(handlers.get('application:quit')!(event, { injected: true })).rejects.toThrow(/not allowed/);
    await expect(handlers.get('application:quit')!(event, {})).resolves.toEqual({ closing: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(close).toHaveBeenCalledOnce();
  });

  it('validates pushed sync events and rejects contract extensions', () => {
    expect(validateSyncProgressWire({ scope: 'all', completed: 1, total: 2, percent: 50 })).toMatchObject({ percent: 50 });
    expect(validateSyncCompletedWire({ source: 'scheduler', feedId: 7, sectionIds: [1, 2], status: 'ok', newItems: 3 })).toMatchObject({ feedId: 7 });
    expect(() => validateSyncCompletedWire({ source: 'scheduler', feedId: 7, sectionIds: [1], status: 'ok', newItems: 3, injected: true })).toThrow(/not allowed/);
    expect(() => validateSyncProgressWire({ scope: 'all', completed: 1, total: 2, percent: '50' })).toThrow(/must be a number/);
  });});
