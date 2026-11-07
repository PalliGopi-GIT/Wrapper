import PptxGenJS from 'pptxgenjs'
import type { Deck, Slide, DeckSettings } from '../model/types.js'
import { getTheme, type Theme } from '../design/themes.js'
import { safeName } from './common.js'

/**
 * Native PowerPoint generation.
 *
 * Everything here is a real OOXML object — text boxes, autoshapes and
 * native charts. Nothing is rasterised, so the file opens without a
 * repair prompt and every word stays editable.
 */

const IN = (px: number) => px / 96
const PT = (px: number) => Math.round(px * 0.75 * 10) / 10

function rgb(c: string, bg = '#FFFFFF'): string {
  const s = (c || '').trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    if (h.length === 3) return h.split('').map((x) => x + x).join('').toUpperCase()
    return h.slice(0, 6).toUpperCase()
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((v) => v.trim())
    const alpha = parseFloat(a)
    if (alpha >= 0.99) return [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase()
    const bgHex = bg.replace('#', '')
    const br = parseInt(bgHex.slice(0, 2), 16)
    const bgG = parseInt(bgHex.slice(2, 4), 16)
    const bb = parseInt(bgHex.slice(4, 6), 16)
    const blend = (fg: number, back: number) => Math.round(fg * alpha + back * (1 - alpha))
    return [blend(+r, br), blend(+g, bgG), blend(+b, bb)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }
  return '000000'
}

interface Ctx {
  pptx: PptxGenJS
  slide: PptxGenJS.Slide
  theme: Theme
  s: DeckSettings
  deck: Deck
  index: number
  total: number
  W: number
  H: number
  pad: number
  cw: number
}

const F = (ctx: Ctx) => ({
  display: ctx.theme.pptx.display,
  body: ctx.theme.pptx.font,
})

function bg(ctx: Ctx) {
  ctx.slide.background = { color: rgb(ctx.theme.color.bg) }
  if (ctx.theme.mode === 'dark') {
    ctx.slide.addShape('rect', {
      x: 0,
      y: 0,
      w: ctx.W,
      h: 0.02,
      fill: { color: rgb(ctx.theme.color.accent, ctx.theme.color.bg) },
      line: { color: rgb(ctx.theme.color.accent, ctx.theme.color.bg), width: 0 },
    })
  }
}

function eyebrow(ctx: Ctx, text?: string) {
  if (!text) return
  const t = ctx.theme.type.case === 'upper' ? text.toUpperCase() : text
  ctx.slide.addText(t, {
    x: ctx.pad,
    y: ctx.pad * 0.72,
    w: ctx.cw,
    h: 0.28,
    fontFace: F(ctx).body,
    fontSize: 9,
    color: rgb(ctx.theme.color.muted, ctx.theme.color.bg),
    charSpacing: 2,
    bold: false,
  })
}

function footer(ctx: Ctx, showNumber = true) {
  if (!ctx.s.showFooter && !(showNumber && ctx.s.showNumbers)) return
  const y = ctx.H - ctx.pad * 0.62
  ctx.slide.addShape('line', {
    x: ctx.pad,
    y: y - 0.12,
    w: ctx.cw,
    h: 0,
    line: { color: rgb(ctx.theme.color.line, ctx.theme.color.bg), width: 0.75 },
  })
  ctx.slide.addText((ctx.s.brand || ctx.deck.title).toUpperCase(), {
    x: ctx.pad,
    y,
    w: ctx.cw * 0.6,
    h: 0.26,
    fontFace: ctx.theme.pptx.font,
    fontSize: 8,
    color: rgb(ctx.theme.color.muted, ctx.theme.color.bg),
    charSpacing: 1.5,
  })
  if (showNumber && ctx.s.showNumbers) {
    ctx.slide.addText(
      [
        { text: String(ctx.index + 1).padStart(2, '0'), options: { color: rgb(ctx.theme.color.ink, ctx.theme.color.bg) } },
        { text: ` / ${String(ctx.total).padStart(2, '0')}`, options: { color: rgb(ctx.theme.color.muted, ctx.theme.color.bg) } },
      ],
      {
        x: ctx.W - ctx.pad - 2,
        y,
        w: 2,
        h: 0.26,
        align: 'right',
        fontFace: ctx.theme.pptx.font,
        fontSize: 8,
      }
    )
  }
}

function title(ctx: Ctx, text?: string, opts: { size?: number; y?: number; h?: number; w?: number; x?: number } = {}) {
  if (!text) return
  const size = opts.size ?? PT(ctx.theme.type.titleSize * ctx.s.scale)
  ctx.slide.addText(text, {
    x: opts.x ?? ctx.pad,
    y: opts.y ?? ctx.pad * 1.18,
    w: opts.w ?? ctx.cw,
    h: opts.h ?? Math.max(0.9, (size / 72) * 2.2),
    fontFace: F(ctx).display,
    fontSize: size,
    bold: ctx.theme.type.displayWeight >= 600,
    color: rgb(ctx.theme.color.ink, ctx.theme.color.bg),
    valign: 'top',
    lineSpacingMultiple: ctx.theme.type.lineHeight,
    charSpacing: ctx.theme.type.tracking * size * 10,
  })
}

function bodyText(
  ctx: Ctx,
  text: string | undefined,
  opts: { x?: number; y?: number; w?: number; h?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right' }
) {
  if (!text) return
  ctx.slide.addText(text, {
    x: opts.x ?? ctx.pad,
    y: opts.y ?? ctx.pad,
    w: opts.w ?? ctx.cw,
    h: opts.h ?? 1,
    fontFace: F(ctx).body,
    fontSize: opts.size ?? PT(ctx.theme.type.bodySize * ctx.s.scale),
    color: rgb(opts.color ?? ctx.theme.color.inkSoft, ctx.theme.color.bg),
    valign: 'top',
    lineSpacingMultiple: 1.5,
    align: opts.align ?? 'left',
  })
}

function newCtx(pptx: PptxGenJS, deck: Deck, index: number): Ctx {
  const theme = getTheme(deck.theme)
  const slide = pptx.addSlide()
  const ctx: Ctx = {
    pptx,
    slide,
    theme,
    s: deck.settings,
    deck,
    index,
    total: deck.slides.length,
    W: 13.333,
    H: 7.5,
    pad: IN(theme.shape.pad * deck.settings.density),
    cw: 13.333 - 2 * IN(theme.shape.pad * deck.settings.density),
  }
  bg(ctx)
  return ctx
}

/* ------------------------------------------------------------------ */

export function buildPptx(deck: Deck): PptxGenJS {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'CADENCE', width: 13.333, height: 7.5 })
  pptx.layout = 'CADENCE'
  pptx.author = 'Cadence'
  pptx.company = deck.settings.brand || 'Cadence'
  pptx.title = deck.title
  pptx.subject = deck.subtitle

  deck.slides.forEach((slide, i) => {
    const ctx = newCtx(pptx, deck, i)
    renderType(ctx, slide)
    if (slide.notes) ctx.slide.addNotes(slide.notes)
  })

  return pptx
}

export async function exportPptx(deck: Deck): Promise<Blob> {
  return (await buildPptx(deck).write({ outputType: 'blob' })) as Blob
}

export async function exportPptxBuffer(deck: Deck): Promise<Buffer> {
  return (await buildPptx(deck).write({ outputType: 'nodebuffer' })) as Buffer
}

export async function downloadPptx(deck: Deck) {
  const blob = await exportPptx(deck)
  const { downloadBlob } = await import('./common')
  downloadBlob(blob, `${safeName(deck.title)}.pptx`)
}

/* ------------------------------------------------------------------ */

function renderType(ctx: Ctx, slide: Slide) {
  eyebrow(ctx, slide.eyebrow)
  const ink = rgb(ctx.theme.color.ink, ctx.theme.color.bg)
  const muted = rgb(ctx.theme.color.muted, ctx.theme.color.bg)
  const soft = rgb(ctx.theme.color.inkSoft, ctx.theme.color.bg)
  const accent = rgb(ctx.theme.color.accent, ctx.theme.color.bg)
  const accentInk = rgb(ctx.theme.color.accentInk, ctx.theme.color.accent)
  const line = rgb(ctx.theme.color.line, ctx.theme.color.bg)

  switch (slide.type) {
    case 'title': {
      const hero = PT(ctx.theme.type.heroSize * ctx.s.scale)
      ctx.slide.addText(slide.title ?? '', {
        x: ctx.pad,
        y: ctx.H * 0.36,
        w: ctx.cw * 0.92,
        h: 2.6,
        fontFace: F(ctx).display,
        fontSize: hero,
        bold: ctx.theme.type.displayWeight >= 600,
        color: ink,
        valign: 'bottom',
        lineSpacingMultiple: ctx.theme.type.lineHeight,
        charSpacing: ctx.theme.type.tracking * hero * 10,
      })
      if (slide.subtitle) {
        ctx.slide.addText(slide.subtitle, {
          x: ctx.pad,
          y: ctx.H * 0.36 + 2.75,
          w: ctx.cw * 0.72,
          h: 1.1,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.leadSize * ctx.s.scale),
          color: soft,
          lineSpacingMultiple: 1.4,
        })
      }
      footer(ctx, false)
      break
    }

    case 'section': {
      ctx.slide.addText(String(ctx.index + 1).padStart(2, '0'), {
        x: ctx.pad,
        y: ctx.H * 0.3,
        w: 3.4,
        h: 1.4,
        fontFace: F(ctx).display,
        fontSize: 110,
        color: rgb(ctx.theme.color.surface, ctx.theme.color.bg),
        bold: true,
      })
      title(ctx, slide.title, { x: ctx.pad + 3.2, y: ctx.H * 0.32, w: ctx.cw - 3.2, size: PT(ctx.theme.type.heroSize * 0.7 * ctx.s.scale) })
      bodyText(ctx, slide.subtitle, { x: ctx.pad + 3.2, y: ctx.H * 0.32 + 1.5, w: ctx.cw - 3.2, size: PT(ctx.theme.type.leadSize * ctx.s.scale), color: muted })
      footer(ctx)
      break
    }

    case 'statement': {
      const hero = PT(ctx.theme.type.heroSize * 0.74 * ctx.s.scale)
      ctx.slide.addText(slide.title ?? '', {
        x: ctx.pad,
        y: ctx.H * 0.28,
        w: ctx.cw,
        h: 2.8,
        fontFace: F(ctx).display,
        fontSize: hero,
        bold: ctx.theme.type.displayWeight >= 600,
        color: ink,
        valign: 'middle',
        lineSpacingMultiple: 1.08,
        charSpacing: ctx.theme.type.tracking * hero * 10,
      })
      bodyText(ctx, slide.subtitle, { y: ctx.H * 0.28 + 2.95, w: ctx.cw * 0.78, size: PT(ctx.theme.type.leadSize * ctx.s.scale), color: muted })
      footer(ctx)
      break
    }

    case 'bullets': {
      title(ctx, slide.title, { h: 1.1 })
      let y = ctx.pad * 1.18 + 1.25
      const bullets = (slide.bullets ?? []).slice(0, 5)
      const rowH = Math.min(1.05, (ctx.H - y - ctx.pad * 1.6) / Math.max(bullets.length, 1))
      bullets.forEach((b, bi) => {
        ctx.slide.addShape('line', {
          x: ctx.pad,
          y,
          w: ctx.cw,
          h: 0,
          line: { color: line, width: 0.75 },
        })
        ctx.slide.addText(String(bi + 1).padStart(2, '0'), {
          x: ctx.pad,
          y: y + 0.14,
          w: 0.5,
          h: 0.3,
          fontFace: ctx.theme.pptx.font,
          fontSize: 9,
          color: accent,
        })
        ctx.slide.addText(
          [
            { text: b.text, options: { fontSize: PT(ctx.theme.type.bodySize * 1.18 * ctx.s.scale), color: ink, bold: true } },
            ...(b.detail
              ? [{ text: '\n' + b.detail, options: { fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale), color: muted, bold: false } }]
              : []),
          ],
          {
            x: ctx.pad + 0.55,
            y: y + 0.12,
            w: ctx.cw - 0.55,
            h: rowH - 0.1,
            fontFace: F(ctx).body,
            valign: 'top',
            lineSpacingMultiple: 1.3,
          }
        )
        y += rowH
      })
      footer(ctx)
      break
    }

    case 'split': {
      title(ctx, slide.title, { w: ctx.cw * 0.5, h: 1.4 })
      bodyText(ctx, slide.body, { y: ctx.pad * 1.18 + 1.5, w: ctx.cw * 0.5, h: 1.4 })
      ;(slide.bullets ?? []).slice(0, 3).forEach((b, bi) => {
        ctx.slide.addText(`·  ${b.text}`, {
          x: ctx.pad,
          y: ctx.pad * 1.18 + 2.95 + bi * 0.36,
          w: ctx.cw * 0.5,
          h: 0.3,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
          color: soft,
        })
      })
      const px = ctx.pad + ctx.cw * 0.56
      const pw = ctx.cw * 0.44
      const py = ctx.pad * 1.18
      const ph = ctx.H - py - ctx.pad * 1.35
      if (slide.image?.src) {
        try {
          ctx.slide.addImage({
            path: slide.image.src,
            x: px,
            y: py,
            w: pw,
            h: ph,
            sizing: { type: 'cover', w: pw, h: ph },
          })
        } catch {
          ctx.slide.addShape('rect', { x: px, y: py, w: pw, h: ph, fill: { color: rgb(ctx.theme.color.surface, ctx.theme.color.bg) }, line: { color: line, width: 0.75 } })
        }
      } else {
        ctx.slide.addShape('rect', {
          x: px,
          y: py,
          w: pw,
          h: ph,
          fill: { color: rgb(ctx.theme.color.surface, ctx.theme.color.bg) },
          line: { color: line, width: 0.75 },
        })
        ctx.slide.addText(slide.stats?.[0]?.value ?? '—', {
          x: px,
          y: py + ph / 2 - 0.7,
          w: pw,
          h: 1.2,
          align: 'center',
          fontFace: F(ctx).display,
          fontSize: 72,
          bold: true,
          color: accent,
        })
      }
      footer(ctx)
      break
    }

    case 'stats': {
      title(ctx, slide.title, { h: 1 })
      const stats = (slide.stats ?? []).slice(0, 4)
      const top = ctx.H * 0.42
      const colW = ctx.cw / Math.max(stats.length, 1)
      stats.forEach((st, si) => {
        const x = ctx.pad + si * colW
        ctx.slide.addShape('line', { x, y: top - 0.28, w: colW - 0.2, h: 0, line: { color: line, width: 0.75 } })
        ctx.slide.addText(st.value, {
          x,
          y: top,
          w: colW - 0.2,
          h: 1.1,
          fontFace: F(ctx).display,
          fontSize: 54,
          bold: ctx.theme.type.displayWeight >= 600,
          color: si === 0 ? accent : ink,
        })
        ctx.slide.addText(st.label, {
          x,
          y: top + 1.15,
          w: colW - 0.3,
          h: 0.8,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
          color: soft,
          lineSpacingMultiple: 1.4,
        })
        if (st.note)
          ctx.slide.addText(st.note, {
            x,
            y: top + 1.95,
            w: colW - 0.3,
            h: 0.3,
            fontFace: ctx.theme.pptx.font,
            fontSize: 8,
            color: muted,
          })
      })
      footer(ctx)
      break
    }

    case 'stat': {
      const v = slide.stats?.[0]?.value ?? ''
      ctx.slide.addText(v, {
        x: ctx.pad,
        y: ctx.H * 0.26,
        w: ctx.cw * 0.46,
        h: 1.5,
        fontFace: F(ctx).display,
        fontSize: 150,
        bold: ctx.theme.type.displayWeight >= 600,
        color: accent,
        valign: 'middle',
      })
      ctx.slide.addShape('line', {
        x: ctx.pad + ctx.cw * 0.5,
        y: ctx.H * 0.24,
        w: 0,
        h: ctx.H * 0.42,
        line: { color: line, width: 0.75 },
      })
      title(ctx, slide.title, { x: ctx.pad + ctx.cw * 0.54, y: ctx.H * 0.26, w: ctx.cw * 0.46, size: PT(ctx.theme.type.titleSize * 0.78 * ctx.s.scale) })
      bodyText(ctx, slide.body, {
        x: ctx.pad + ctx.cw * 0.54,
        y: ctx.H * 0.26 + 1.65,
        w: ctx.cw * 0.44,
        size: PT(ctx.theme.type.bodySize * ctx.s.scale),
        color: soft,
      })
      footer(ctx)
      break
    }

    case 'quote': {
      ctx.slide.addText('“', {
        x: ctx.pad,
        y: ctx.H * 0.18,
        w: 1,
        h: 0.9,
        fontFace: F(ctx).display,
        fontSize: 84,
        color: accent,
      })
      ctx.slide.addText(slide.quote?.text ?? '', {
        x: ctx.pad,
        y: ctx.H * 0.26,
        w: ctx.cw * 0.82,
        h: 2.6,
        fontFace: F(ctx).display,
        fontSize: PT(ctx.theme.type.titleSize * 0.92 * ctx.s.scale),
        color: ink,
        lineSpacingMultiple: 1.24,
        valign: 'top',
      })
      ctx.slide.addText(
        [
          { text: slide.quote?.author ?? '', options: { color: ink, bold: true } },
          { text: '   ' + (slide.quote?.role ?? ''), options: { color: muted } },
        ],
        {
          x: ctx.pad + 0.45,
          y: ctx.H * 0.26 + 2.7,
          w: ctx.cw,
          h: 0.4,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
        }
      )
      ctx.slide.addShape('line', { x: ctx.pad, y: ctx.H * 0.26 + 2.9, w: 0.4, h: 0, line: { color: accent, width: 2 } })
      footer(ctx)
      break
    }

    case 'timeline': {
      title(ctx, slide.title, { h: 1 })
      const steps = (slide.steps ?? []).slice(0, 5)
      const top = ctx.H * 0.46
      const colW = ctx.cw / Math.max(steps.length, 1)
      ctx.slide.addShape('line', { x: ctx.pad, y: top - 0.35, w: ctx.cw, h: 0, line: { color: line, width: 0.75 } })
      steps.forEach((st, si) => {
        const x = ctx.pad + si * colW + 0.06
        ctx.slide.addShape('ellipse', { x, y: top - 0.41, w: 0.13, h: 0.13, fill: { color: si === 0 ? accent : muted } })
        ctx.slide.addText(st.when ?? `0${si + 1}`, {
          x,
          y: top,
          w: colW - 0.3,
          h: 0.3,
          fontFace: ctx.theme.pptx.font,
          fontSize: 9,
          color: accent,
          charSpacing: 1.5,
        })
        ctx.slide.addText(st.title, {
          x,
          y: top + 0.34,
          w: colW - 0.32,
          h: 0.5,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.bodySize * 1.02 * ctx.s.scale),
          bold: true,
          color: ink,
        })
        ctx.slide.addText(st.text ?? '', {
          x,
          y: top + 0.88,
          w: colW - 0.32,
          h: 0.9,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
          color: muted,
          lineSpacingMultiple: 1.4,
        })
      })
      footer(ctx)
      break
    }

    case 'compare': {
      title(ctx, slide.title, { h: 1 })
      const cols = (slide.columns ?? []).slice(0, 2)
      const top = ctx.H * 0.42
      const boxW = (ctx.cw - 0.3) / 2
      const boxH = ctx.H - top - ctx.pad * 1.35
      cols.forEach((col, ci) => {
        const x = ctx.pad + ci * (boxW + 0.3)
        ctx.slide.addShape('rect', {
          x,
          y: top,
          w: boxW,
          h: boxH,
          fill: { color: ci === 1 ? rgb(ctx.theme.color.surface, ctx.theme.color.bg) : rgb(ctx.theme.color.bg) },
          line: { color: line, width: 0.75 },
        })
        ctx.slide.addText(col.title, {
          x: x + 0.3,
          y: top + 0.26,
          w: boxW - 0.6,
          h: 0.4,
          fontFace: F(ctx).display,
          fontSize: 18,
          bold: true,
          color: col.tone === 'accent' || ci === 1 ? accent : ink,
        })
        ;(col.items ?? []).slice(0, 5).forEach((it, ii) => {
          ctx.slide.addText(`·  ${it}`, {
            x: x + 0.3,
            y: top + 0.85 + ii * 0.62,
            w: boxW - 0.6,
            h: 0.5,
            fontFace: F(ctx).body,
            fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
            color: soft,
            lineSpacingMultiple: 1.3,
          })
        })
      })
      footer(ctx)
      break
    }

    case 'process': {
      title(ctx, slide.title, { h: 1 })
      const steps = (slide.steps ?? []).slice(0, 5)
      const top = ctx.H * 0.44
      const gap = 0.18
      const w = (ctx.cw - gap * (steps.length - 1)) / Math.max(steps.length, 1)
      const h = ctx.H - top - ctx.pad * 1.4
      steps.forEach((st, si) => {
        const x = ctx.pad + si * (w + gap)
        ctx.slide.addShape('rect', {
          x,
          y: top,
          w,
          h,
          fill: { color: rgb(ctx.theme.color.surface, ctx.theme.color.bg) },
          line: { color: si === 0 ? accent : line, width: 0.75 },
        })
        ctx.slide.addText(st.when ?? `0${si + 1}`, {
          x: x + 0.2,
          y: top + 0.2,
          w: w - 0.4,
          h: 0.28,
          fontFace: ctx.theme.pptx.font,
          fontSize: 8.5,
          color: accent,
          charSpacing: 1.5,
        })
        ctx.slide.addText(st.title, {
          x: x + 0.2,
          y: top + 0.6,
          w: w - 0.4,
          h: 0.5,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.bodySize * 1.05 * ctx.s.scale),
          bold: true,
          color: ink,
        })
        ctx.slide.addText(st.text ?? '', {
          x: x + 0.2,
          y: top + 1.2,
          w: w - 0.4,
          h: h - 1.4,
          fontFace: F(ctx).body,
          fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
          color: muted,
          lineSpacingMultiple: 1.4,
          valign: 'top',
        })
      })
      footer(ctx)
      break
    }

    case 'chart': {
      title(ctx, slide.title, { h: 0.95 })
      const ch = slide.chart
      if (ch) {
        const map: Record<string, string> = { area: 'area', line: 'line', column: 'column', bar: 'bar', donut: 'doughnut' }
        try {
          ctx.slide.addChart(
            map[ch.kind] as never,
            [
              {
                name: ch.caption || 'Series',
                labels: ch.data.map((d) => d.label),
                values: ch.data.map((d) => d.value),
              },
            ],
            {
              x: ctx.pad,
              y: ctx.H * 0.32,
              w: ctx.cw,
              h: ctx.H * 0.44,
              showLegend: false,
              showTitle: false,
              chartColors: [accent],
              catAxisLabelColor: muted,
              valAxisLabelColor: muted,
              catAxisLineShow: false,
              valAxisLineShow: false,
              valGridLine: { color: line, style: 'dash', size: 0.5 },
              catGridLine: { style: 'none' },
              dataLabelColor: soft,
              dataLabelFontSize: 9,
              showValue: ch.kind !== 'donut',
            } as never
          )
        } catch {
          /* chart type unsupported — leave the title */
        }
      }
      if (slide.body) {
        ctx.slide.addShape('line', { x: ctx.pad, y: ctx.H - ctx.pad * 1.55, w: ctx.cw, h: 0, line: { color: line, width: 0.75 } })
        bodyText(ctx, slide.body, { y: ctx.H - ctx.pad * 1.45, h: 0.5, size: PT(ctx.theme.type.smallSize * ctx.s.scale) })
      }
      footer(ctx)
      break
    }

    case 'table': {
      title(ctx, slide.title, { h: 0.95 })
      const t = slide.table
      if (t) {
        const rows: PptxGenJS.TableRow[] = [
          t.head.map((h) => ({
            text: h.toUpperCase(),
            options: { bold: true, color: muted, fontSize: 9, fill: { color: rgb(ctx.theme.color.bg) }, border: { type: 'none' } },
          })),
          ...t.rows.map((r) =>
            r.map((cell, ci) => ({
              text: cell,
              options: {
                color: ci === 0 ? ink : soft,
                fontSize: PT(ctx.theme.type.smallSize * 0.92 * ctx.s.scale),
                bold: ci === 0,
                border: { type: 'solid' as const, color: line, pt: 0.5 },
              },
            }))
          ),
        ]
        ctx.slide.addTable(rows, {
          x: ctx.pad,
          y: ctx.H * 0.34,
          w: ctx.cw,
          colW: t.head.map(() => ctx.cw / t.head.length),
          border: { type: 'solid', color: line, pt: 0.5 },
          fontFace: F(ctx).body,
          rowH: 0.42,
          valign: 'middle',
        })
      }
      footer(ctx)
      break
    }

    case 'matrix': {
      const plotW = ctx.cw * 0.6
      const plotH = Math.min(ctx.H * 0.56, plotW / 1.25)
      const px = ctx.pad
      const py = ctx.H * 0.3
      ctx.slide.addShape('line', { x: px, y: py + plotH, w: plotW, h: 0, line: { color: line, width: 1 } })
      ctx.slide.addShape('line', { x: px, y: py, w: 0, h: plotH, line: { color: line, width: 1 } })
      ;(slide.matrix?.items ?? []).forEach((it, ii) => {
        const cx = px + (Math.min(96, Math.max(4, it.x)) / 100) * plotW
        const cy = py + plotH - (Math.min(94, Math.max(6, it.y)) / 100) * plotH
        ctx.slide.addShape('ellipse', {
          x: cx - 0.055,
          y: cy - 0.055,
          w: 0.11,
          h: 0.11,
          fill: { color: ii === 0 ? accent : muted },
        })
        ctx.slide.addText(it.label, {
          x: cx - 0.6,
          y: cy + 0.09,
          w: 1.2,
          h: 0.24,
          align: 'center',
          fontFace: F(ctx).body,
          fontSize: 8.5,
          color: ii === 0 ? ink : muted,
        })
      })
      ctx.slide.addText(slide.matrix?.x ?? '', {
        x: px,
        y: py + plotH + 0.14,
        w: plotW,
        h: 0.24,
        align: 'center',
        fontFace: ctx.theme.pptx.font,
        fontSize: 8,
        color: muted,
        charSpacing: 1.5,
      })
      ctx.slide.addText(slide.matrix?.y ?? '', {
        x: px - 1.5,
        y: py + plotH / 2,
        w: 1.4,
        h: 0.24,
        align: 'right',
        fontFace: ctx.theme.pptx.font,
        fontSize: 8,
        color: muted,
        charSpacing: 1.5,
      })
      const lx = px + plotW + 0.55
      title(ctx, slide.title, { x: lx, y: ctx.H * 0.3, w: ctx.cw - plotW - 0.55, h: 1.2, size: PT(ctx.theme.type.titleSize * 0.8 * ctx.s.scale) })
      ;(slide.bullets ?? []).forEach((b, bi) => {
        ctx.slide.addText(
          [
            { text: b.text, options: { color: ink, bold: true } },
            ...(b.detail ? [{ text: '\n' + b.detail, options: { color: muted, bold: false } }] : []),
          ],
          {
            x: lx,
            y: ctx.H * 0.3 + 1.5 + bi * 0.9,
            w: ctx.cw - plotW - 0.55,
            h: 0.8,
            fontFace: F(ctx).body,
            fontSize: PT(ctx.theme.type.smallSize * ctx.s.scale),
            lineSpacingMultiple: 1.4,
          }
        )
      })
      footer(ctx)
      break
    }

    case 'image': {
      if (slide.image?.src) {
        try {
          ctx.slide.addImage({
            path: slide.image.src,
            x: 0,
            y: 0,
            w: ctx.W,
            h: ctx.H,
            sizing: { type: 'cover', w: ctx.W, h: ctx.H },
          })
          ctx.slide.addShape('rect', {
            x: 0,
            y: ctx.H * 0.45,
            w: ctx.W,
            h: ctx.H * 0.55,
            fill: { color: '000000', transparency: 62 },
            line: { color: '000000', width: 0, transparency: 100 },
          })
        } catch {
          /* fall through to plain title */
        }
      }
      ctx.slide.addText(slide.title ?? '', {
        x: ctx.pad,
        y: ctx.H * 0.62,
        w: ctx.cw,
        h: 1.5,
        fontFace: F(ctx).display,
        fontSize: PT(ctx.theme.type.titleSize * ctx.s.scale),
        bold: ctx.theme.type.displayWeight >= 600,
        color: slide.image?.src ? 'FFFFFF' : ink,
      })
      if (slide.body)
        ctx.slide.addText(slide.body, {
          x: ctx.pad,
          y: ctx.H * 0.62 + 1.55,
          w: ctx.cw,
          h: 0.4,
          fontFace: ctx.theme.pptx.font,
          fontSize: 9,
          color: slide.image?.src ? 'D8D8D8' : muted,
          charSpacing: 1.5,
        })
      break
    }

    case 'closing': {
      const hero = PT(ctx.theme.type.heroSize * 0.82 * ctx.s.scale)
      ctx.slide.addText(slide.title ?? '', {
        x: ctx.pad,
        y: ctx.H * 0.28,
        w: ctx.cw * 0.86,
        h: 2.4,
        fontFace: F(ctx).display,
        fontSize: hero,
        bold: ctx.theme.type.displayWeight >= 600,
        color: ink,
        valign: 'middle',
        lineSpacingMultiple: 1.05,
      })
      bodyText(ctx, slide.subtitle, { y: ctx.H * 0.28 + 2.5, w: ctx.cw * 0.7, size: PT(ctx.theme.type.leadSize * ctx.s.scale), color: soft })
      if (slide.body) {
        const w = Math.max(1.8, slide.body.length * 0.11)
        ctx.slide.addShape('roundRect', {
          x: ctx.pad,
          y: ctx.H * 0.28 + 3.35,
          w,
          h: 0.46,
          fill: { color: accent },
          line: { color: accent, width: 0 },
          rectRadius: 0.23,
        })
        ctx.slide.addText(slide.body, {
          x: ctx.pad,
          y: ctx.H * 0.28 + 3.35,
          w,
          h: 0.46,
          align: 'center',
          valign: 'middle',
          fontFace: F(ctx).body,
          fontSize: 10.5,
          bold: true,
          color: accentInk,
        })
      }
      footer(ctx, false)
      break
    }

    default:
      title(ctx, slide.title)
      footer(ctx)
  }
}
