export type ColorSchemeDefinition = {
  id: string;
  label: string;
  colors: readonly [string, string, string, string, string];
  margin: string;
  gradient?: boolean;
};

export const COLOR_SCHEMES = [
  { id: 'readit', label: 'READIT', colors: ['#161b22', '#1d2430', '#0b1018', '#2f80ed', '#1f9d55'], margin: '#0f1218' },
  { id: 'warm', label: 'Warm', colors: ['#f5cbcb', '#e0a899', '#b0ba99', '#8bae66', '#e0d5b0'], margin: '#715a5a' },
  { id: 'night', label: 'Night', colors: ['#1d2530', '#2f3b46', '#403d50', '#6a7591', '#a3b1c6'], margin: '#dcd7c9' },
  { id: 'sea', label: 'Sea', colors: ['#c2f4f5', '#d1e9f6', '#aaffc7', '#6fd1d7', '#ece2d0'], margin: '#4274d9' },
  { id: 'space', label: 'Space', colors: ['#2e3a5a', '#4a4e69', '#22223b', '#9a8c98', '#c9ada7'], margin: '#c9ada7' },
  { id: 'off-white', label: 'Off-white', colors: ['#fbefef', '#ffe2e2', '#f5cbcb', '#c5b3d3', '#ece2d0'], margin: '#c5b3d3' },
  { id: 'kids', label: 'Kids', colors: ['#dec9e9', '#c2f4f5', '#ffb8e0', '#faf0ca', '#aaffc7'], margin: '#dec9e9' },
  { id: 'sky', label: 'Sky', colors: ['#d1e9f6', '#c2f4f5', '#cee8ff', '#b6e5d8', '#f5faff'], margin: '#95ccdd' },
  { id: 'cold', label: 'Cold', colors: ['#4274d9', '#95ccdd', '#d0e7e5', '#aaffc7', '#6fd1d7'], margin: '#4274d9' },
  { id: 'neon', label: 'Neon', colors: ['#baffd9', '#fff8b0', '#ffcce7', '#d5c6ff', '#e6e6e6'], margin: '#37353e' },
  { id: 'nature', label: 'Nature', colors: ['#8bae66', '#b0ba99', '#ece2d0', '#dcd7c9', '#86a788'], margin: '#628141' },
  { id: 'summer', label: 'Summer', colors: ['#ffe5a9', '#ffb3c1', '#a8e6cf', '#ffdcdc', '#b5d5c5'], margin: '#f5cbcb' },
  { id: 'fall', label: 'Fall', colors: ['#dcbf8c', '#b56576', '#6d6875', '#e7ad81', '#a6a57a'], margin: '#715a5a' },
  { id: 'autumn', label: 'Autumn', colors: ['#c97b63', '#d8a48f', '#7d5a5a', '#f5deb3', '#a49e8d'], margin: '#715a5a' },
  { id: 'winter', label: 'Winter', colors: ['#5e81ac', '#7aa7c7', '#dce4eb', '#f5f5f5', '#a8dadc'], margin: '#4274d9' },
  { id: 'sunny', label: 'Sunny', colors: ['#ffe8a8', '#ffd9b3', '#fff1c9', '#fce1a8', '#f5cbcb'], margin: '#ebd5ab' },
  { id: 'gradient', label: 'Gradient', colors: ['#dec9e9', '#d1e9f6', '#c2f4f5', '#b0ba99', '#f5cbcb'], margin: '#715a5a', gradient: true },
  { id: 'forest', label: 'Forest', colors: ['#2d6a4f', '#52796f', '#6a994e', '#a7c957', '#f2e8cf'], margin: '#2d6a4f' },
  { id: 'mountain', label: 'Mountain', colors: ['#6b7b8c', '#2e4057', '#6a994e', '#dcd7c9', '#bfa084'], margin: '#2e4057' },
  { id: 'desert', label: 'Desert', colors: ['#d4a373', '#e9c46a', '#e6b98d', '#b56576', '#f5f5dc'], margin: '#715a5a' },
  { id: 'sad', label: 'Sad', colors: ['#a2b5bb', '#c9d6df', '#b8c6d8', '#e4e8ec', '#9ba8b1'], margin: '#4274d9' },
  { id: 'happy', label: 'Happy', colors: ['#f9d1b7', '#ffefa0', '#ffe2e2', '#b8e1ff', '#d3f8e2'], margin: '#f5cbcb' },
  { id: 'neutral', label: 'Neutral', colors: ['#f5f5f5', '#e7e7e7', '#dcd7c9', '#b0a695', '#a3a3a3'], margin: '#715a5a' },
] as const satisfies readonly ColorSchemeDefinition[];

export type ColorSchemeId = (typeof COLOR_SCHEMES)[number]['id'];
export const DEFAULT_COLOR_SCHEME_ID: ColorSchemeId = 'readit';

function rgb(color: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hex(channels: readonly number[]) {
  return '#' + channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
}

export function mixColors(background: string, foreground: string, amount: number) {
  const from = rgb(background);
  const to = rgb(foreground);
  return hex(from.map((channel, index) => channel + (to[index] - channel) * amount));
}

export function relativeLuminance(color: string) {
  const channels = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(first: string, second: string) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

export function contrastText(background: string) {
  const dark = '#000000';
  const light = '#ffffff';
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

export function isColorSchemeId(value: unknown): value is ColorSchemeId {
  return typeof value === 'string' && COLOR_SCHEMES.some((scheme) => scheme.id === value);
}

export function getColorScheme(value: unknown) {
  return COLOR_SCHEMES.find((scheme) => scheme.id === value) || COLOR_SCHEMES[0];
}

export function colorSchemeVariables(value: unknown): Record<`--${string}`, string> {
  const scheme = getColorScheme(value);
  const [toolbar, section, card, control, manager] = scheme.colors;
  const sectionText = contrastText(section);
  const cardText = contrastText(card);
  const managerText = contrastText(manager);
  const controlText = contrastText(control);
  const canvasText = contrastText(scheme.margin);
  const isGradient = 'gradient' in scheme && scheme.gradient;
  return {
    '--bg': isGradient ? `linear-gradient(135deg, ${scheme.margin}, ${toolbar})` : scheme.margin,
    '--toolbar-bg': toolbar,
    '--panel': section,
    '--panel-2': toolbar,
    '--manager-bg': manager,
    '--card-bg': card,
    '--control-bg': control,
    '--control-hover': mixColors(control, controlText, 0.12),
    '--text': sectionText,
    '--muted': mixColors(section, sectionText, 0.68),
    '--toolbar-text': contrastText(toolbar),
    '--manager-text': managerText,
    '--manager-muted': mixColors(manager, managerText, 0.68),
    '--card-text': cardText,
    '--card-muted': mixColors(card, cardText, 0.68),
    '--control-text': controlText,
    '--canvas-text': canvasText,
    '--accent': control,
    '--accent-contrast': controlText,
    '--accent-2': manager,
    '--border': mixColors(section, sectionText, 0.26),
    '--manager-border': mixColors(manager, managerText, 0.26),
    '--card-border': mixColors(card, cardText, 0.2),
    '--focus': contrastRatio(control, section) >= 3 ? control : sectionText,
    '--section-bg': isGradient ? `linear-gradient(135deg, ${section}, ${card})` : section,
  };
}

export function applyColorScheme(
  target: { style: { setProperty(name: string, value: string): void }; dataset?: { colorScheme?: string } },
  value: unknown
) {
  const scheme = getColorScheme(value);
  for (const [name, color] of Object.entries(colorSchemeVariables(scheme.id))) target.style.setProperty(name, color);
  if (target.dataset) target.dataset.colorScheme = scheme.id;
  return scheme;
}