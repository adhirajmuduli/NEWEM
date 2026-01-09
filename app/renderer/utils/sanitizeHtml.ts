// Attach a safe HTML sanitizer to window.READIT.Utils
(function attach() {
  (window as any).READIT = (window as any).READIT || {};
  (window as any).READIT.Utils = (window as any).READIT.Utils || {};

  function removeEventHandlers(el: Element) {
    const toRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        toRemove.push(attr.name);
      }
    }
    for (const name of toRemove) {
      el.removeAttribute(name);
    }
  }

  function isOneByOneImage(img: HTMLImageElement): boolean {
    const wAttr = (img.getAttribute('width') || '').trim();
    const hAttr = (img.getAttribute('height') || '').trim();
    if (wAttr === '1' && hAttr === '1') return true;

    const style = (img.getAttribute('style') || '').toLowerCase();
    if (style.includes('width:1px') && style.includes('height:1px')) return true;

    return false;
  }

  function sanitizeHtml(input: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(input || '', 'text/html');
      const body = doc.body;

      // Strip active/embedded content
      for (const el of Array.from(body.querySelectorAll('script, iframe, object, embed'))) {
        el.remove();
      }

      // Remove tracking 1×1 images
      for (const img of Array.from(body.querySelectorAll('img'))) {
        if (isOneByOneImage(img)) {
          img.remove();
        }
      }

      for (const img of Array.from(body.querySelectorAll('img'))) {
        const src = (img.getAttribute('src') || '').trim().toLowerCase();
        if (!src.startsWith('http://') && !src.startsWith('https://')) {
            img.remove();
        }
      }


      for (const a of Array.from(body.querySelectorAll('a'))) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }

      function isSafeUrl(url: string): boolean {
        const u = url.trim().toLowerCase();
        return u.startsWith('http://') || u.startsWith('https://');
      }

      for (const a of Array.from(body.querySelectorAll('a'))) {
        const href = a.getAttribute('href');
        if (!href || !isSafeUrl(href)) {
            a.removeAttribute('href');
        }
      }

      for (const img of Array.from(body.querySelectorAll('img'))) {
        img.removeAttribute('srcset');
      }

      for (const el of Array.from(body.querySelectorAll('*'))) {
        el.removeAttribute('style');
      }

      // Remove inline handlers across all elements
      const all = body.querySelectorAll('*');
      for (const el of Array.from(all)) {
        removeEventHandlers(el as Element);
      }

      // Optionally whitelist allowed tags: not strictly needed if removing active content
      // We preserve paragraphs, headings, links, lists, basic inline formatting.
      return body.innerHTML;
    } catch {
      return '';
    }
  }

  (window as any).READIT.Utils.sanitizeHtml = sanitizeHtml;
})();