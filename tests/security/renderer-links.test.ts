import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('renderer external link handling', () => {
  it('routes article links through validated handlers instead of target blank navigation', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'components', 'ItemList.tsx'), 'utf8');
    expect(source).toContain('props.openItem(props.sectionId, item)');
    expect(source).toContain('e.preventDefault()');
    expect(source).not.toContain('target: "_blank"');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('location.href');

    const shellSource = fs.readFileSync(path.resolve(process.cwd(), 'app', 'renderer', 'components', 'AppShell.tsx'), 'utf8');
    expect(shellSource).toContain('api().openReaderTab({');
    expect(shellSource).toContain('api().openExternal({ url: item.link })');
  });
});