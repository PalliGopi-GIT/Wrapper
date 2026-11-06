import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'
import type { Deck } from '../model/types'
import { renderSlide } from '../render/slide'
import { collectCss, downloadBlob, fitSlidesIn, safeName, withRenderedSlide } from './common'

/** Vector, browser-printed PDF. Text stays selectable and fonts stay crisp. */
export async function printPdf(deck: Deck): Promise<void> {
  const css = await collectCss()
  const slides = deck.slides
    .map((s, i) => {
      const el = renderSlide(s, deck, i, deck.slides.length)
      return `<section class="print-page">${el.outerHTML}</section>`
    })
    .join('')

  const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`)
    .join('')

  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    deck.title
  )}</title>${fontLinks}
  <style>${css}</style>
  <style>
    @page { size: 13.333in 7.5in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .print-page { width: 1280px; height: 720px; overflow: hidden; break-after: page; page-break-after: always; }
    .print-page:last-child { break-after: auto; page-break-after: auto; }
    .slide { box-shadow: none !important; }
    @media screen { body { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; background: #222; } }
  </style></head><body>${slides}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  const idoc = iframe.contentDocument
  if (!win || !idoc) {
    iframe.remove()
    throw new Error('Could not open a print surface.')
  }
  idoc.open()
  idoc.write(doc)
  idoc.close()
  try {
    await (idoc as Document & { fonts?: FontFaceSet }).fonts?.ready
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 600))
  fitSlidesIn(idoc)
  win.focus()
  win.print()
  setTimeout(() => iframe.remove(), 60_000)
}

/** Raster PDF, built entirely client-side. */
export async function buildPdf(deck: Deck): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], compress: true })
  pdf.deletePage(1)

  for (let i = 0; i < deck.slides.length; i++) {
    const el = renderSlide(deck.slides[i], deck, i, deck.slides.length)
    try {
      const dataUrl = await withRenderedSlide(el, (node) =>
        toPng(node.firstElementChild as HTMLElement, {
          width: 1280,
          height: 720,
          pixelRatio: 2,
          cacheBust: false,
          backgroundColor: getComputedStyle(el).getPropertyValue('--bg') || '#ffffff',
        })
      )
      pdf.addPage([1280, 720], 'landscape')
      pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720, undefined, 'FAST')
    } catch {
      pdf.addPage([1280, 720], 'landscape')
      pdf.setFillColor(20, 20, 22)
      pdf.rect(0, 0, 1280, 720, 'F')
      pdf.setTextColor(220, 220, 225)
      pdf.setFontSize(22)
      pdf.text(deck.slides[i].title ?? '', 60, 360)
    }
  }

  return pdf
}

export async function downloadPdf(deck: Deck): Promise<void> {
  const pdf = await buildPdf(deck)
  pdf.save(`${safeName(deck.title)}.pdf`)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}

/** Single-slide PNG download. */
export async function downloadSlidePng(deck: Deck, index: number): Promise<void> {
  const el = renderSlide(deck.slides[index], deck, index, deck.slides.length)
  const dataUrl = await withRenderedSlide(el, (node) =>
    toPng(node.firstElementChild as HTMLElement, {
      width: 1280,
      height: 720,
      pixelRatio: 2,
      cacheBust: false,
    })
  )
  const res = await fetch(dataUrl)
  downloadBlob(await res.blob(), `${safeName(deck.title)}-${String(index + 1).padStart(2, '0')}.png`)
}
