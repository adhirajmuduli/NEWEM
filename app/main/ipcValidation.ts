export type Validator<T> = (value: unknown) => T;

export function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
}

export function rejectUnknown(value: Record<string, unknown>, allowed: string[], name: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${name}.${key} is not allowed`);
  }
}

export function optionalPayload(value: unknown) {
  if (value === undefined || value === null) return {};
  assertPlainObject(value, 'payload');
  return value;
}

export function numberValue(value: unknown, name: string, opts?: { integer?: boolean; min?: number; max?: number }) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`${name} must be a number`);
  if (opts?.integer && !Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  if (opts?.min !== undefined && value < opts.min) throw new Error(`${name} must be >= ${opts.min}`);
  if (opts?.max !== undefined && value > opts.max) throw new Error(`${name} must be <= ${opts.max}`);
  return value;
}

export function booleanValue(value: unknown, name: string) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

export function stringValue(value: unknown, name: string, opts?: { min?: number; max?: number }) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  if (opts?.min !== undefined && value.trim().length < opts.min) throw new Error(`${name} is too short`);
  if (opts?.max !== undefined && value.length > opts.max) throw new Error(`${name} is too long`);
  return value;
}

export function optionalNumber(value: unknown, name: string, opts?: { integer?: boolean; min?: number; max?: number }) {
  return value === undefined ? undefined : numberValue(value, name, opts);
}

export function optionalBoolean(value: unknown, name: string) {
  return value === undefined ? undefined : booleanValue(value, name);
}

export function optionalString(value: unknown, name: string, opts?: { min?: number; max?: number }) {
  return value === undefined ? undefined : stringValue(value, name, opts);
}

function colorValue(value: unknown, name: string) {
  const text = stringValue(value, name, { min: 4, max: 32 }).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(text)) throw new Error(`${name} must be a hex color`);
  return text;
}

function appearanceValue(value: unknown, name: string) {
  assertPlainObject(value, name);
  rejectUnknown(value, ['mode', 'solid', 'gradientFrom', 'gradientTo', 'imageDataUrl'], name);
  const mode = stringValue(value.mode, `${name}.mode`, { min: 1, max: 16 });
  if (!['solid', 'gradient', 'image'].includes(mode)) throw new Error(`${name}.mode is invalid`);
  const imageDataUrl = value.imageDataUrl === undefined ? undefined : stringValue(value.imageDataUrl, `${name}.imageDataUrl`, { min: 1, max: 2_500_000 });
  if (imageDataUrl !== undefined && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageDataUrl)) {
    throw new Error(`${name}.imageDataUrl must be an image data URL`);
  }
  return {
    mode: mode as 'solid' | 'gradient' | 'image',
    solid: value.solid === undefined ? undefined : colorValue(value.solid, `${name}.solid`),
    gradientFrom: value.gradientFrom === undefined ? undefined : colorValue(value.gradientFrom, `${name}.gradientFrom`),
    gradientTo: value.gradientTo === undefined ? undefined : colorValue(value.gradientTo, `${name}.gradientTo`),
    imageDataUrl,
  };
}

export function layoutValue(value: unknown) {
  const obj = optionalPayload(value);
  rejectUnknown(obj, ['mode', 'panels', 'appearance'], 'layout');
  const panels = obj.panels;
  if (!Array.isArray(panels)) throw new Error('layout.panels must be an array');
  const mode = obj.mode === undefined ? undefined : stringValue(obj.mode, 'layout.mode', { min: 1, max: 16 });
  if (mode !== undefined && !['stack', 'columns', 'mosaic', 'focus'].includes(mode)) throw new Error('layout.mode is invalid');
  const appearance: Record<string, ReturnType<typeof appearanceValue>> = {};
  if (obj.appearance !== undefined) {
    assertPlainObject(obj.appearance, 'layout.appearance');
    for (const [key, raw] of Object.entries(obj.appearance)) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(key)) throw new Error('layout.appearance key is invalid');
      appearance[key] = appearanceValue(raw, `layout.appearance.${key}`);
    }
  }
  return {
    mode: mode as 'stack' | 'columns' | 'mosaic' | 'focus' | undefined,
    panels: panels.map((panel, index) => {
      assertPlainObject(panel, `layout.panels[${index}]`);
      rejectUnknown(panel, ['id', 'x', 'y', 'w', 'h'], `layout.panels[${index}]`);
      return {
        id: stringValue(panel.id, `layout.panels[${index}].id`, { min: 1, max: 128 }),
        x: numberValue(panel.x, `layout.panels[${index}].x`, { min: 0 }),
        y: numberValue(panel.y, `layout.panels[${index}].y`, { min: 0 }),
        w: numberValue(panel.w, `layout.panels[${index}].w`, { min: 1 }),
        h: numberValue(panel.h, `layout.panels[${index}].h`, { min: 1 }),
      };
    }),
    appearance,
  };
}

export function passthroughResponse<T>(value: T) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('IPC response must be an object');
  return value;
}

export function handleValidated<TPayload, TResponse>(
  ipc: { handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void },
  channel: string,
  payloadValidator: Validator<TPayload>,
  responseValidator: Validator<TResponse>,
  listener: (payload: TPayload, event: unknown) => TResponse | Promise<TResponse>
) {
  ipc.handle(channel, async (event: unknown, payload: unknown) => {
    const validPayload = payloadValidator(payload);
    const response = await listener(validPayload, event);
    return responseValidator(response);
  });
}

export {};
