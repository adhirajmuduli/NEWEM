import { DEFAULT_COLOR_SCHEME_ID, getColorScheme } from '../../shared/colorSchemes';
import type { ColorSchemeId } from '../../shared/colorSchemes';
import type { LayoutModeWire, LayoutWire, SectionWire } from '../../shared/ipcTypes';

export const MIN_PANEL_WIDTH = 32;
export const MAX_PANEL_WIDTH = 100;
export const DEFAULT_LAYOUT_MODE: LayoutModeWire = 'stack';

export function clampPanelWidth(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.round(value)));
}

export function defaultPanelsForSections(sections: SectionWire[]) {
  return sections.map((section, index) => ({ id: section.key, x: index, y: 0, w: 100, h: 1 }));
}

export function resetLayoutForSections(
  sections: SectionWire[],
  theme: ColorSchemeId = DEFAULT_COLOR_SCHEME_ID
): LayoutWire {
  return {
    mode: DEFAULT_LAYOUT_MODE,
    theme,
    panels: defaultPanelsForSections(sections),
    appearance: {},
  };
}
export function normalizeLayoutForSections(layout: LayoutWire | undefined, sections: SectionWire[]): LayoutWire {
  const sectionKeys = new Set(sections.map((section) => section.key));
  const mode = layout?.mode || DEFAULT_LAYOUT_MODE;
  const byId = new Map((layout?.panels || []).filter((panel) => sectionKeys.has(panel.id)).map((panel) => [panel.id, panel]));
  const panels = sections.map((section, fallbackIndex) => {
    const existing = byId.get(section.key);
    return {
      id: section.key,
      x: Number.isFinite(existing?.x) ? Number(existing?.x) : fallbackIndex,
      y: Number.isFinite(existing?.y) ? Number(existing?.y) : 0,
      w: clampPanelWidth(existing?.w ?? 100),
      h: Math.max(1, Number.isFinite(existing?.h) ? Number(existing?.h) : 1),
    };
  }).sort((a, b) => a.x - b.x || sections.findIndex((section) => section.key === a.id) - sections.findIndex((section) => section.key === b.id));

  return {
    mode,
    theme: getColorScheme(layout?.theme).id,
    panels: panels.map((panel, index) => ({ ...panel, x: index })),
    appearance: Object.fromEntries(Object.entries(layout?.appearance || {}).filter(([key]) => sectionKeys.has(key))),
  };
}

export function orderedSectionsForLayout(sections: SectionWire[], layout: LayoutWire) {
  const position = new Map(layout.panels.map((panel, index) => [panel.id, index]));
  return [...sections].sort((a, b) => (position.get(a.key) ?? 9999) - (position.get(b.key) ?? 9999));
}

export function resizePanel(layout: LayoutWire, panelId: string, width: number): LayoutWire {
  return {
    ...layout,
    panels: layout.panels.map((panel) => panel.id === panelId ? { ...panel, w: clampPanelWidth(width) } : panel),
  };
}

export function movePanel(layout: LayoutWire, panelId: string, direction: -1 | 1): LayoutWire {
  const panels = [...layout.panels].sort((a, b) => a.x - b.x);
  const index = panels.findIndex((panel) => panel.id === panelId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= panels.length) return layout;
  [panels[index], panels[target]] = [panels[target], panels[index]];
  return { ...layout, panels: panels.map((panel, x) => ({ ...panel, x })) };
}

export function panelWidth(layout: LayoutWire, panelId: string) {
  return clampPanelWidth(layout.panels.find((panel) => panel.id === panelId)?.w ?? 100);
}