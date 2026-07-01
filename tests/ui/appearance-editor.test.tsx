// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppearanceEditor, MAX_IMAGE_BYTES, readAppearanceImage } from '../../app/renderer/components/AppearanceEditor';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('section appearance editor', () => {
  let root: Root;

  afterEach(() => root?.unmount());

  it('rejects oversized images before reading them', async () => {
    const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' });
    await expect(readAppearanceImage(oversized)).rejects.toThrow('1.5 MiB');
  });

  it('accepts a 1.45 MiB JPEG even when Windows provides no MIME type', async () => {
    const jpeg = new File([new Uint8Array(Math.floor(1.45 * 1024 * 1024))], 'compressed.jpg');
    await expect(readAppearanceImage(jpeg)).resolves.toMatch(/^data:image\/jpeg;base64,/);
  });

  it('can reuse the same picture file for different section-keyed editors', async () => {
    const onApply = vi.fn(async () => undefined);
    const onError = vi.fn();
    const file = new File(['image'], 'same.png', { type: 'image/png' });
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById('root')!);

    async function applyFor(sectionKey: string) {
      await act(async () => root.render(
        <AppearanceEditor key={sectionKey} sectionKey={sectionKey} appearance={{ mode: 'image' }} onApply={onApply} onError={onError} />
      ));
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
      await flush();
      expect(input.value).toBe('');
      const ok = [...document.querySelectorAll('button')].find((button) => button.textContent === 'OK') as HTMLButtonElement;
      await act(async () => ok.click());
      await flush();
    }

    await applyFor('technology');
    await applyFor('world');

    expect(onError).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenNthCalledWith(1, 'technology', expect.objectContaining({ mode: 'image', imageDataUrl: expect.stringContaining('data:image/png;base64,') }));
    expect(onApply).toHaveBeenNthCalledWith(2, 'world', expect.objectContaining({ mode: 'image', imageDataUrl: expect.stringContaining('data:image/png;base64,') }));
  });
});
