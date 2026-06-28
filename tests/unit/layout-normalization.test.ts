import { describe, expect, it } from 'vitest';
import type { LayoutWire, SectionWire } from '../../app/shared/ipcTypes';
import { clampPanelWidth, movePanel, normalizeLayoutForSections, resetLayoutForSections, resizePanel } from '../../app/renderer/layout/GridLayout';

function section(id: number, key: string, name = key): SectionWire {
  return { id, key, name, position_index: id, feeds: [] };
}

describe('Stage 6 layout normalization', () => {
  it('clamps panel widths and removes panels for deleted sections', () => {
    const layout: LayoutWire = {
      mode: 'columns',
      panels: [
        { id: 'world', x: 0, y: 0, w: 140, h: 1 },
        { id: 'deleted', x: 1, y: 0, w: 50, h: 1 },
        { id: 'tech', x: 2, y: 0, w: 10, h: 1 },
      ],
      appearance: { world: { mode: 'solid', solid: '#111111' }, deleted: { mode: 'solid', solid: '#222222' } },
    };

    const normalized = normalizeLayoutForSections(layout, [section(1, 'tech'), section(2, 'world'), section(3, 'science')]);

    expect(normalized.panels.map((panel) => panel.id)).toEqual(['world', 'tech', 'science']);
    expect(normalized.panels.find((panel) => panel.id === 'world')?.w).toBe(100);
    expect(normalized.panels.find((panel) => panel.id === 'tech')?.w).toBe(32);
    expect(normalized.panels.find((panel) => panel.id === 'science')?.w).toBe(100);
    expect(normalized.appearance).toEqual({ world: { mode: 'solid', solid: '#111111' } });
  });

  it('resizes, reorders, and resets by stable panel key', () => {
    const sections = [section(1, 'a'), section(2, 'b')];
    const initial = resetLayoutForSections(sections, 'columns');
    const resized = resizePanel(initial, 'a', 44.8);
    const moved = movePanel(resized, 'a', 1);

    expect(clampPanelWidth(12)).toBe(32);
    expect(resized.panels.find((panel) => panel.id === 'a')?.w).toBe(45);
    expect(moved.panels.map((panel) => panel.id)).toEqual(['b', 'a']);
    expect(resetLayoutForSections(sections, 'stack').panels.map((panel) => panel.w)).toEqual([100, 100]);
  });
});