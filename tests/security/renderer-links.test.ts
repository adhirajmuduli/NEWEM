import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('renderer external link handling', () => {
  it('routes article links through preload openExternal instead of target blank navigation', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'components', 'ItemList.tsx'), 'utf8');
    expect(source).toContain('openExternal');
    expect(source).toContain('e.preventDefault()');
    expect(source).not.toContain('target: "_blank"');
  });
});