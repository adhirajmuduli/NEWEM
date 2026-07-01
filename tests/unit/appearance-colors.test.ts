import { describe, expect, it } from 'vitest';
import { normalizeColorInput } from '../../app/renderer/utils/colors';

describe('appearance color input', () => {
  it('normalizes supported hex and rgb formats', () => {
    expect(normalizeColorInput('#ABC')).toBe('#aabbcc');
    expect(normalizeColorInput('#151B24')).toBe('#151b24');
    expect(normalizeColorInput('rgb(21, 27, 36)')).toBe('#151b24');
  });

  it('rejects malformed and out-of-range colors', () => {
    expect(normalizeColorInput('rgb(300, 0, 0)')).toBeNull();
    expect(normalizeColorInput('#12')).toBeNull();
    expect(normalizeColorInput('green')).toBeNull();
  });
});
