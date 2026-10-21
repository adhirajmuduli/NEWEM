// Attach a safe HTML sanitizer to window.READIT.Utils
(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Utils = (window as any).READIT.Utils || {};

  const ACTIVE_CONTENT = 'script, iframe, object, embed, style, link, meta, base, form, input, button, select, textarea, audio, video, source, track, dialog, template';
  const URL_ATTRIBUTES = ['href', 'action', 'formaction', 'xlink:href', 'ping', 'poster', 'background', 'cite', 'longdesc'];
  const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i;

  function isHttpUrl(value: string) {
    const text = value.trim().toLowerCase();
    return text.startsWith('http://') || text.startsWith('https://');
  }

  function isOneByOneImage(img: HTMLImageElement): boolean {
    const wAttr = (img.getAttribute('width') || '').trim();
    const hAttr = (img.getAttribute('height') || '').trim();
    if (wAttr === '1' && hAttr === '1') return true;

    const style = (img.getAttribute('style') || '').toLowerCase();
    if (style.includes('width:1px') && style.includes('height:1px')) return true;

    return false;
  }

  function sanitizeImages(body: HTMLElement) {
    for (const img of Array.from(body.querySelectorAll('img'))) {
      if (isOneByOneImage(img)) {
        img.remove();
        continue;
      }
      const src = (img.getAttribute('src') || '').trim();
      if (!isHttpUrl(src) && !SAFE_IMAGE_DATA_URL.test(src)) {
        img.remove();
        continue;
      }
      img.removeAttribute('srcset');
      img.removeAttribute('background');
    }
  }

  function sanitizeAttributes(body: HTMLElement) {
    for (const el of Array.from(body.querySelectorAll('*'))) {
      el.removeAttribute('style');
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (URL_ATTRIBUTES.includes(name) && !isHttpUrl(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  function sanitizeHtml(input: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input || '', 'text/html');
      const body = doc.body;

      for (const el of Array.from(body.querySelectorAll(ACTIVE_CONTENT))) {
        el.remove();
      }

      sanitizeImages(body);
      sanitizeAttributes(body);

      for (const a of Array.from(body.querySelectorAll('a'))) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }

      return body.innerHTML;
    } catch {
      return '';
    }
  }

  (window as any).READIT.Utils.sanitizeHtml = sanitizeHtml;
})();

export {};
