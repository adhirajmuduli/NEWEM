import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../app/core/storage/db';
import { registerIpcHandlers } from '../../app/main/ipc';

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
  });

  it('accepts valid section and layout requests', async () => {
    const handlers = setupHandlers();
    const created = await handlers.get('sections:create')!(null, { name: 'Security', key: 'security' }) as any;
    expect(created.changed).toBe(1);
    const layout = await handlers.get('layout:set')!(null, { layout: { panels: [{ id: 'security', x: 0, y: 0, w: 3, h: 2 }] } }) as any;
    expect(layout.layout.panels[0]).toMatchObject({ id: 'security', w: 3 });
  });
});