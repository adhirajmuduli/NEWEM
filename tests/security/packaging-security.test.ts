import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('release packaging security contract', () => {
  const config = fs.readFileSync(path.resolve(process.cwd(), 'electron-builder.yml'), 'utf8');

  it('keeps ASAR enabled and native SQLite explicitly unpacked', () => {
    expect(config).toMatch(/^asar: true$/m);
    expect(config).toContain('node_modules/better-sqlite3/build/Release/electron/**');
    expect(config).toMatch(/^npmRebuild: false$/m);
  });

  it('excludes local data, tests, source maps, and TypeScript source', () => {
    for (const rule of ['!data/**', '!tests/**', '!coverage/**', '!**/*.map', '!**/*.{ts,tsx,cts,mts}']) expect(config).toContain(rule);
  });

  it('ships CSP and migrations as immutable extra resources', () => {
    expect(config).toContain('from: config');
    expect(config).toContain('from: dist/app/core/storage/migrations');
    expect(config).toContain('to: migrations');
  });
});
