import JSZip from 'jszip'
import { toPng } from 'html-to-image'
import type { Deck } from '../model/types'
import { renderSlide } from '../render/slide'
import { downloadBlob, safeName, withRenderedSlide } from './common'

export async function downloadPngs(deck: Deck): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder(safeName(deck.title)) ?? zip
  for (let i = 0; i < deck.slides.length; i++) {
    const el = renderSlide(deck.slides[i], deck, i, deck.slides.length)
    try {
      const dataUrl = await withRenderedSlide(el, (node) =>
        toPng(node.firstElementChild as HTMLElement, {
          width: 1280,
          height: 720,
          pixelRatio: 2,
          cacheBust: false,
        })
      )
      const base64 = dataUrl.split(',')[1]
      folder.file(`${String(i + 1).padStart(2, '0')}-${safeName(deck.slides[i].title ?? 'slide')}.png`, base64, {
        base64: true,
      })
    } catch {
      /* skip a slide that cannot be rasterised */
    }
  }
  folder.file('notes.md', markdownOf(deck))
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${safeName(deck.title)}-png.zip`)
}

export function markdownOf(deck: Deck): string {
  const lines: string[] = [`# ${deck.title}`, '', deck.subtitle, '']
  deck.slides.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title ?? '(untitled)'}`, '')
    if (s.eyebrow) lines.push(`*${s.eyebrow}*`, '')
    if (s.subtitle) lines.push(s.subtitle, '')
    if (s.body) lines.push(s.body, '')
    if (s.bullets?.length) {
      s.bullets.forEach((b) => lines.push(`- **${b.text}**${b.detail ? ` — ${b.detail}` : ''}`))
      lines.push('')
    }
    if (s.stats?.length) {
      s.stats.forEach((st) => lines.push(`- ${st.value} — ${st.label}${st.note ? ` (${st.note})` : ''}`))
      lines.push('')
    }
    if (s.steps?.length) {
      s.steps.forEach((st) => lines.push(`- ${st.when ? `${st.when}: ` : ''}${st.title}${st.text ? ` — ${st.text}` : ''}`))
      lines.push('')
    }
    if (s.columns?.length) {
      s.columns.forEach((c) => {
        lines.push(`### ${c.title}`)
        c.items?.forEach((it) => lines.push(`- ${it}`))
        lines.push('')
      })
    }
    if (s.quote) {
      lines.push(`> ${s.quote.text}`, `> — ${s.quote.author ?? ''}`, '')
    }
    if (s.chart) {
      s.chart.data.forEach((d) => lines.push(`- ${d.label}: ${s.chart?.prefix ?? ''}${d.value}${s.chart?.suffix ?? ''}`))
      lines.push('')
    }
    if (s.table) {
      lines.push(`| ${s.table.head.join(' | ')} |`)
      lines.push(`| ${s.table.head.map(() => '---').join(' | ')} |`)
      s.table.rows.forEach((r) => lines.push(`| ${r.join(' | ')} |`))
      lines.push('')
    }
    if (s.notes) lines.push(`> **Speaker notes:** ${s.notes}`, '')
    lines.push('---', '')
  })
  return lines.join('\n')
}

export function downloadMarkdown(deck: Deck) {
  downloadBlob(new Blob([markdownOf(deck)], { type: 'text/markdown' }), `${safeName(deck.title)}.md`)
}
