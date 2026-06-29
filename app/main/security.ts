import fs from 'fs';
import path from 'path';

export type CspDirectives = Record<string, string[]>;

export const DEFAULT_CSP: CspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'connect-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'frame-ancestors': ["'none'"],
};

export function serializeCsp(directives: CspDirectives = DEFAULT_CSP) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

function isDirectiveMap(value: unknown): value is CspDirectives {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.length > 0 && entry.every((item) => typeof item === 'string')
  );
}

export function loadCspConfig(configPath = path.resolve(process.cwd(), 'config', 'csp.json')) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
    if (!isDirectiveMap(parsed)) return DEFAULT_CSP;
    return { ...DEFAULT_CSP, ...parsed };
  } catch {
    return DEFAULT_CSP;
  }
}

export function cspAllowsRemoteScripts(directives: CspDirectives) {
  return (directives['script-src'] ?? []).some((value) => /^https?:/i.test(value) || value === '*');
}

export function getSecureWebPreferences(preloadPath: string) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: preloadPath,
  };
}

export function isAllowedExternalUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export {};