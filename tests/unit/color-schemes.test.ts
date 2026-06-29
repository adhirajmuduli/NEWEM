import { describe, expect, it, vi } from 'vitest';
import {
  applyColorScheme,
  COLOR_SCHEMES,
  colorSchemeVariables,
  contrastRatio,
  getColorScheme,
} from '../../app/shared/colorSchemes';

describe('reusable color schemes', () => {
  it('contains the complete supplied palette catalog with five colors and one margin color', () => {
    expect(COLOR_SCHEMES).toHaveLength(23);
    expect(COLOR_SCHEMES.map((scheme) => scheme.id)).toEqual(expect.arrayContaining([
      'warm', 'night', 'sea', 'space', 'off-white', 'kids', 'sky', 'cold', 'neon', 'nature',
      'summer', 'fall', 'autumn', 'winter', 'sunny', 'gradient', 'forest', 'mountain',
      'desert', 'sad', 'happy', 'neutral',
    ]));
    for (const scheme of COLOR_SCHEMES) {
      expect(scheme.colors).toHaveLength(5);
      expect([...scheme.colors, scheme.margin].every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
    }
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

    expect(applyColorScheme(target, 'forest').id).toBe('forest');
    expect(target.dataset.colorScheme).toBe('forest');
    expect(values.get('--manager-bg')).toBe('#f2e8cf');
    expect(getColorScheme('unknown').id).toBe('readit');
  });
});