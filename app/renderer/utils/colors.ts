export function normalizeColorInput(value: string): string | null {
  const text = value.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(text);
  if (shortHex) return '#' + [...shortHex[1]].map((character) => character + character).join('').toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();

  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text);
  if (!rgb) return null;
  const channels = rgb.slice(1).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) return null;
  return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}
