import { describe, expect, it } from 'vitest';
import { getSecureWebPreferences } from '../../app/main/security';

describe('sandboxed preload smoke contract', () => {
  it('can be configured with sandboxed preload path for app boot', () => {
    const prefs = getSecureWebPreferences('dist/app/preload/bridge.js');
    expect(prefs.sandbox).toBe(true);
    expect(prefs.preload).toContain('bridge.js');
  });
});