import React from 'react';
import type { SectionAppearanceWire } from '../../shared/ipcTypes';
import { normalizeColorInput } from '../utils/colors';

export const MAX_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024);
const SAFE_RASTER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const SAFE_RASTER_EXTENSION = /\.(?:jpe?g|png|webp|gif|avif)$/i;

function imageMimeFromName(name: string) {
  const extension = name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return null;
}

export function readAppearanceImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeType = SAFE_RASTER_MIME_TYPES.has(file.type.toLowerCase());
    const safeExtension = SAFE_RASTER_EXTENSION.test(file.name);
    const normalizedMime = safeType ? file.type.toLowerCase() : imageMimeFromName(file.name);
    if (!safeType && !(safeExtension && (!file.type || file.type === 'application/octet-stream'))) {
      reject(new Error('Select a JPEG, PNG, WebP, GIF, or AVIF image'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`Image must be 1.5 MiB (${MAX_IMAGE_BYTES.toLocaleString()} bytes) or smaller`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(normalizedMime ? result.replace(/^data:[^;]*;/i, `data:${normalizedMime};`) : result);
    };
    reader.onerror = () => reject(new Error('Image import failed'));
    reader.readAsDataURL(file);
  });
}

function ColorControl(props: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="appearance-color-control">
      <span>{props.label}</span>
      <div>
        <input type="color" value={normalizeColorInput(props.value) || '#151b24'} onChange={(event) => props.onChange(event.currentTarget.value)} />
        <input value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} placeholder="#151b24 or rgb(21, 27, 36)" />
      </div>
    </label>
  );
}

export function AppearanceEditor(props: {
  sectionKey: string;
  appearance: SectionAppearanceWire;
  onApply(sectionKey: string, appearance: SectionAppearanceWire): Promise<void>;
  onError(message: string): void;
}) {
  const [mode, setMode] = React.useState<SectionAppearanceWire['mode']>(props.appearance.mode);
  const [solid, setSolid] = React.useState(props.appearance.solid || '#151b24');
  const [gradientFrom, setGradientFrom] = React.useState(props.appearance.gradientFrom || '#182334');
  const [gradientTo, setGradientTo] = React.useState(props.appearance.gradientTo || '#0d1420');
  const [imageDataUrl, setImageDataUrl] = React.useState(props.appearance.imageDataUrl || '');
  const [busy, setBusy] = React.useState(false);
  const readSequence = React.useRef(0);

  React.useEffect(() => {
    readSequence.current += 1;
    setMode(props.appearance.mode);
    setSolid(props.appearance.solid || '#151b24');
    setGradientFrom(props.appearance.gradientFrom || '#182334');
    setGradientTo(props.appearance.gradientTo || '#0d1420');
    setImageDataUrl(props.appearance.imageDataUrl || '');
  }, [props.sectionKey, props.appearance.mode, props.appearance.solid, props.appearance.gradientFrom, props.appearance.gradientTo, props.appearance.imageDataUrl]);

  async function apply() {
    let next: SectionAppearanceWire;
    if (mode === 'solid') {
      const normalized = normalizeColorInput(solid);
      if (!normalized) {
        props.onError('Enter a valid hex or rgb solid colour.');
        return;
      }
      next = { mode, solid: normalized };
    } else if (mode === 'gradient') {
      const from = normalizeColorInput(gradientFrom);
      const to = normalizeColorInput(gradientTo);
      if (!from || !to) {
        props.onError('Enter valid hex or rgb gradient colours.');
        return;
      }
      next = { mode, gradientFrom: from, gradientTo: to };
    } else {
      if (!imageDataUrl) {
        props.onError('Select a picture before applying it.');
        return;
      }
      next = { mode, imageDataUrl };
    }

    setBusy(true);
    try {
      await props.onApply(props.sectionKey, next);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const sequence = ++readSequence.current;
    try {
      const dataUrl = await readAppearanceImage(file);
      if (sequence === readSequence.current) setImageDataUrl(dataUrl);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="appearance-editor">
      <div className="appearance-mode-tiles" role="group" aria-label="Section background type">
        {(['solid', 'gradient', 'image'] as const).map((option) => (
          <button key={option} type="button" className={mode === option ? 'selected' : ''} onClick={() => setMode(option)}>
            {option === 'image' ? 'Picture' : option}
          </button>
        ))}
      </div>

      <div className="appearance-editor-body">
        {mode === 'solid' ? <ColorControl label="Solid colour" value={solid} onChange={setSolid} /> : null}
        {mode === 'gradient' ? (
          <>
            <ColorControl label="Gradient from" value={gradientFrom} onChange={setGradientFrom} />
            <ColorControl label="Gradient to" value={gradientTo} onChange={setGradientTo} />
          </>
        ) : null}
        {mode === 'image' ? (
          <label className="appearance-picture-control">
            <span>Picture</span>
            <input key={props.sectionKey} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void selectImage(event)} />
            {imageDataUrl ? <span className="appearance-picture-preview" style={{ backgroundImage: `url(${imageDataUrl})` }} aria-label="Selected picture preview" /> : null}
          </label>
        ) : null}
        <button type="button" className="primary appearance-apply" onClick={() => void apply()} disabled={busy}>{busy ? 'Applying...' : 'OK'}</button>
      </div>
    </div>
  );
}
