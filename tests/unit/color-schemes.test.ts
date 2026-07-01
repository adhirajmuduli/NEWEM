import { describe, expect, it, vi } from 'vitest';
import {
  applyColorScheme,
  COLOR_SCHEMES,
  DISABLED_COLOR_SCHEMES,
  colorSchemeVariables,
  contrastRatio,
  getColorScheme,
} from '../../app/shared/colorSchemes';

describe('reusable color schemes', () => {
  it('exposes only the dark READIT palette while preserving disabled definitions', () => {
    expect(COLOR_SCHEMES).toHaveLength(1);
    expect(COLOR_SCHEMES[0].id).toBe('readit');
    expect(DISABLED_COLOR_SCHEMES).toHaveLength(22);
    expect(COLOR_SCHEMES[0].colors).not.toContain('#1f9d55');
    expect(COLOR_SCHEMES[0].margin).toBe('#080b10');
  });
  it('derives contrast-safe text for every semantic surface', () => {
    for (const scheme of COLOR_SCHEMES) {
      const variables = colorSchemeVariables(scheme.id);
      const pairs = [
        [scheme.colors[1], variables['--text']],
        [scheme.colors[0], variables['--toolbar-text']],
        [scheme.colors[4], variables['--manager-text']],
        [scheme.colors[2], variables['--card-text']],
        [scheme.colors[3], variables['--control-text']],
        [scheme.margin, variables['--canvas-text']],
      ];
      for (const [background, foreground] of pairs) {
        expect(contrastRatio(background, foreground), scheme.id).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('applies variables immediately and safely falls back to READIT', () => {
    const values = new Map<string, string>();
    const target = {
      style: { setProperty: vi.fn((name: string, value: string) => values.set(name, value)) },
      dataset: {} as { colorScheme?: string },
    };

    expect(applyColorScheme(target, 'forest').id).toBe('readit');
    expect(target.dataset.colorScheme).toBe('readit');
    expect(values.get('--manager-bg')).toBe('#111821');
    expect(getColorScheme('unknown').id).toBe('readit');
  });
});