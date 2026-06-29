import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cspAllowsRemoteScripts, getSecureWebPreferences, loadCspConfig, serializeCsp } from '../../app/main/security';
import { PRELOAD_API_VERSION } from '../../app/shared/ipcTypes';

describe('Electron hardening policy', () => {
  it('uses sandboxed, isolated BrowserWindow preferences', () => {
    const prefs = getSecureWebPreferences('preload.js');
    expect(prefs).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: 'preload.js',
    });
  });

  it('loads strict CSP without remote script permissions', () => {
    const csp = loadCspConfig(path.resolve(process.cwd(), 'config', 'csp.json'));
    expect(cspAllowsRemoteScripts(csp)).toBe(false);
    expect(serializeCsp(csp)).toContain("default-src 'self'");
    expect(serializeCsp(csp)).toContain("script-src 'self'");
    expect(serializeCsp(csp)).toContain("object-src 'none'");
  });

  it('renderer HTML has no remote scripts or remote script CSP allowances', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'index.html'), 'utf8');
    expect(html).not.toMatch(/https:\/\/unpkg\.com/i);
    expect(html).not.toMatch(/script-src[^;]*https:/i);
    expect(html).toContain('<script type="module" src="./index.tsx"></script>');
  });

  it('sandboxed preload is runtime self-contained while retaining shared compile-time types', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app', 'preload', 'bridge.ts'), 'utf8');
    expect(source).toContain("import type {");
    expect(source).not.toContain("import { PRELOAD_API_VERSION as API_VERSION }");
    expect(source).toContain("const API_VERSION: typeof PRELOAD_API_VERSION = 1");
  });

  it('preload API contract is versioned', () => {
    expect(PRELOAD_API_VERSION).toBe(1);
  });

  it('starts fullscreen without the redundant native application menu', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app', 'main', 'windows.ts'), 'utf8');
    expect(source).toContain('fullscreen: true');
    expect(source).toContain('Menu.setApplicationMenu(null)');
    expect(source).toContain('installWindowChrome(win)');
  });
});