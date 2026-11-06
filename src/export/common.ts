import { autofit } from '../render/slide'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeName(s: string): string {
  return (s || 'deck')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'deck'
}

/** Collect the app's stylesheet text so exports are self-contained. */
export async function collectCss(): Promise<string> {
  const chunks: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (rules) {
        chunks.push(Array.from(rules).map((r) => r.cssText).join('\n'))
        continue
      }
    } catch {
      /* cross-origin (google fonts) — fall through */
    }
    if (sheet.href) {
      try {
        const res = await fetch(sheet.href)
        if (res.ok) chunks.push(await res.text())
      } catch {
        /* ignore */
      }
    }
  }
  const inline = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
  return `${chunks.join('\n')}\n${inline}`
}

export function waitForImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
          setTimeout(resolve, 4000)
        })
    )
  ).then(() => undefined)
}

export function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()))
}

/** Render one slide at full size inside a detached, positioned host. */
export async function withRenderedSlide<T>(
  el: HTMLElement,
  fn: (node: HTMLElement) => Promise<T>
): Promise<T> {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;width:1280px;height:720px;pointer-events:none;z-index:-1'
  host.appendChild(el)
  document.body.appendChild(host)
  await nextFrame()
  autofit(el)
  await waitForImages(el)
  try {
    return await fn(host)
  } finally {
    host.remove()
  }
}

/** Run the type-fit pass over a set of already-laid-out slides. */
export function fitSlidesIn(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.slide').forEach((el) => autofit(el))
}

/** Standalone script used inside exported HTML documents. */
export const AUTOFIT_JS = `
window.__fitSlides = function () {
  document.querySelectorAll('.slide').forEach(function (el) {
    var page = el.closest('.page');
    var prev = page ? page.style.display : null;
    if (page) page.style.display = 'block';
    var frame = el.querySelector('.s-frame');
    if (frame) {
      el.style.setProperty('--fit', '1');
      var k = 1;
      for (var i = 0; i < 18; i++) {
        if (frame.scrollHeight <= frame.clientHeight + 1) break;
        k -= 0.035;
        if (k < 0.6) break;
        el.style.setProperty('--fit', String(Math.round(k * 1000) / 1000));
      }
    }
    if (page) page.style.display = prev || '';
  });
};
__fitSlides();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(__fitSlides);
window.addEventListener('load', __fitSlides);
`
