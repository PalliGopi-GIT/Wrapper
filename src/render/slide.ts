import type { ChartSpec, Deck, Slide } from '../model/types'
import { getTheme, themeVars } from '../design/themes'

const esc = (s?: string | number): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )

const edit = (path: string, text: string | undefined, cls = '', tag = 'div'): string =>
  `<${tag} class="${cls}" data-edit="${path}" data-empty="${text ? 0 : 1}">${esc(text)}</${tag}>`

const initials = (s: string): string =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/* ============================ charts ============================ */

let gradSeq = 0

function chartSvg(spec: ChartSpec): string {
  const data = (spec.data ?? []).filter((d) => Number.isFinite(d.value))
  if (!data.length) return '<div class="dim">No data</div>'
  const max = Math.max(...data.map((d) => d.value), 1)
  const fmt = (v: number) => `${spec.prefix ?? ''}${formatNum(v)}${spec.suffix ?? ''}`

  if (spec.kind === 'donut') {
    const total = data.reduce((a, b) => a + b.value, 0) || 1
    const colors = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--muted)']
    const cx = 150
    const cy = 150
    const rO = 128
    const rI = 82
    let angle = -Math.PI / 2
    const paths: string[] = []
    data.forEach((d, i) => {
      const sweep = (d.value / total) * Math.PI * 2
      paths.push(arc(cx, cy, rO, rI, angle, angle + sweep - 0.012, colors[i % colors.length]))
      angle += sweep
    })
    const legend = data
      .map(
        (d, i) =>
          `<div class="lg"><i style="background:${colors[i % colors.length]}"></i><span>${esc(
            d.label
          )}</span><b>${fmt(d.value)}</b></div>`
      )
      .join('')
    return `
      <div class="donut-wrap">
        <svg viewBox="0 0 300 300" style="width:300px;flex:none">
          ${paths.join('')}
          <text x="150" y="142" text-anchor="middle" fill="var(--ink)" style="font-family:var(--font-display);font-size:34px;letter-spacing:-0.03em">${fmt(
            total
          )}</text>
          <text x="150" y="168" text-anchor="middle" fill="var(--muted)" style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.14em;text-transform:uppercase">Total</text>
        </svg>
        <div class="donut-legend">${legend}</div>
      </div>`
  }

  const W = 1000
  const H = 300
  const padL = 8
  const padB = 34
  const padT = 12
  const plotH = H - padB - padT
  const n = data.length

  if (spec.kind === 'bar') {
    const rowH = 52
    const H2 = Math.max(150, n * rowH + 18)
    const labelW = 190
    return `<svg viewBox="0 0 ${W} ${H2}">
      ${data
        .map((d, i) => {
          const y = 9 + i * rowH
          const w = (d.value / max) * (W - labelW - 76)
          return `
          <text x="0" y="${y + rowH / 2 + 4}" fill="var(--ink-soft)" style="font-family:var(--font-body);font-size:13px">${esc(
            d.label
          )}</text>
          <rect x="${labelW}" y="${y + rowH / 2 - 9}" width="${Math.max(
            3,
            w
          )}" height="18" rx="2" fill="${i === 0 ? 'var(--accent)' : 'var(--c4)'}"/>
          <text x="${labelW + w + 12}" y="${y + rowH / 2 + 4}" fill="var(--ink)" style="font-family:var(--font-mono);font-size:11.5px">${fmt(
            d.value
          )}</text>`
        })
        .join('')}
    </svg>`
  }

  const slot = (W - padL * 2) / n
  const bw = slot * (spec.kind === 'column' ? 0.56 : 0.3)
  const baseY = padT + plotH

  if (spec.kind === 'column') {
    return `<svg viewBox="0 0 ${W} ${H}">
      <line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="var(--line)" stroke-width="1"/>
      ${data
        .map((d, i) => {
          const h = (d.value / max) * plotH
          const x = padL + i * slot + slot / 2 - bw / 2
          return `
          <rect x="${x}" y="${baseY - h}" width="${bw}" height="${Math.max(
            2,
            h
          )}" rx="2" fill="${i === data.length - 1 ? 'var(--accent)' : 'var(--c4)'}"/>
          <text x="${x + bw / 2}" y="${baseY - h - 8}" text-anchor="middle" fill="var(--ink-soft)" style="font-family:var(--font-mono);font-size:11px">${fmt(
            d.value
          )}</text>
          <text x="${x + bw / 2}" y="${baseY + 20}" text-anchor="middle" fill="var(--muted)" style="font-family:var(--font-body);font-size:11.5px">${esc(
            d.label
          )}</text>`
        })
        .join('')}
    </svg>`
  }

  // line / area
  const pts = data.map((d, i) => {
    const x = padL + i * slot + slot / 2
    const y = baseY - (d.value / max) * plotH
    return { x, y, d }
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${line} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`
  const id = `g${gradSeq++}`
  return `<svg viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--c1)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--c1)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${[0.25, 0.5, 0.75, 1].map(
      (f) =>
        `<line x1="0" y1="${padT + plotH * f}" x2="${W}" y2="${
          padT + plotH * f
        }" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 5" opacity="0.7"/>`
    )}
    ${spec.kind === 'area' ? `<path d="${areaPath}" fill="url(#${id})"/>` : ''}
    <path d="${line}" fill="none" stroke="var(--c1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts
      .map(
        (p) => `
      <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--bg)" stroke="var(--c1)" stroke-width="2"/>
      <text x="${p.x}" y="${baseY + 20}" text-anchor="middle" fill="var(--muted)" style="font-family:var(--font-body);font-size:11.5px">${esc(
        p.d.label
      )}</text>
      <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" fill="var(--ink-soft)" style="font-family:var(--font-mono);font-size:10.5px">${fmt(
        p.d.value
      )}</text>`
      )
      .join('')}
  </svg>`
}

function arc(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number, fill: string) {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const [x0, y0] = p(rO, a0)
  const [x1, y1] = p(rO, a1)
  const [x2, y2] = p(rI, a1)
  const [x3, y3] = p(rI, a0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `<path d="M${x0},${y0} A${rO},${rO} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rI},${rI} 0 ${large} 0 ${x3},${y3} Z" fill="${fill}"/>`
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${+(v / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(v) >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 10_000) return `${+(v / 1000).toFixed(1)}K`
  return `${+v.toFixed(v % 1 === 0 ? 0 : 1)}`
}

/* ============================ layouts ============================ */

type Ctx = { slide: Slide; deck: Deck; index: number; total: number }

function head(c: Ctx): string {
  if (!c.slide.eyebrow) return ''
  return `<div class="s-head">${edit('eyebrow', c.slide.eyebrow, 's-eyebrow')}</div>`
}

function foot(c: Ctx, opts: { number?: boolean } = {}): string {
  const s = c.deck.settings
  if (!s.showFooter && !(opts.number && s.showNumbers)) return ''
  const brand = s.brand || c.deck.title
  return `<div class="s-foot">
    <span class="brand">${esc(brand)}</span>
    ${opts.number !== false && s.showNumbers ? `<span class="num"><b>${String(c.index + 1).padStart(2, '0')}</b> / ${String(c.total).padStart(2, '0')}</span>` : ''}
  </div>`
}

function bulletsList(s: Slide): string {
  return (s.bullets ?? [])
    .map(
      (b, i) => `<li>
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <span>
          <span class="t" data-edit="bullets.${i}.text">${esc(b.text)}</span>
          ${b.detail !== undefined ? `<span class="d" data-edit="bullets.${i}.detail">${esc(b.detail)}</span>` : ''}
        </span>
      </li>`
    )
    .join('')
}

const L: Record<string, (c: Ctx) => string> = {
  title: (c) => {
    const s = c.slide
    return `<div class="s-frame l-title" data-variant="${esc(s.variant ?? 'left')}">
      <div class="s-body">
        ${s.eyebrow ? edit('eyebrow', s.eyebrow, 's-eyebrow') : ''}
        ${edit('title', s.title, 's-title', 'h1')}
        ${s.subtitle ? edit('subtitle', s.subtitle, 'sub', 'p') : ''}
      </div>
      ${foot(c, { number: false })}
    </div>`
  },

  section: (c) => `<div class="s-frame l-section">
    <div class="s-body">
      <div class="idx">${String(c.index + 1).padStart(2, '0')}</div>
      <div>
        ${edit('title', c.slide.title, 's-title', 'h2')}
        ${c.slide.subtitle ? edit('subtitle', c.slide.subtitle, 'sub', 'p') : ''}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  statement: (c) => `<div class="s-frame l-statement">
    ${head(c)}
    <div class="s-body">
      ${edit('title', c.slide.title, 's-hero', 'h2')}
      ${c.slide.subtitle ? edit('subtitle', c.slide.subtitle, 'sub', 'p') : ''}
    </div>
    ${foot(c)}
  </div>`,

  bullets: (c) => `<div class="s-frame l-bullets" data-variant="${esc(c.slide.variant ?? 'numbered')}">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}
        ${c.slide.body ? edit('body', c.slide.body, 's-text') : ''}
      </div>
      <ul>${bulletsList(c.slide)}</ul>
    </div>
    ${foot(c)}
  </div>`,

  split: (c) => {
    const s = c.slide
    const img = s.image
    const visual = img?.src
      ? `<img src="${esc(img.src)}" alt="${esc(img.alt)}"/>`
      : `<div class="bars"><i></i><i></i><i></i></div>`
    return `<div class="s-frame l-split" data-flip="${s.variant === 'flip' ? 1 : 0}">
      ${head(c)}
      <div class="s-body">
        <div class="col">
          ${edit('title', s.title, 's-title', 'h2')}
          ${s.body ? edit('body', s.body, 's-text') : ''}
          <ul class="list">
            ${(s.bullets ?? [])
              .map(
                (b, i) =>
                  `<li data-edit="bullets.${i}.text">${esc(b.text)}</li>`
              )
              .join('')}
          </ul>
        </div>
        <div class="visual">${visual}</div>
      </div>
      ${foot(c)}
    </div>`
  },

  stats: (c) => `<div class="s-frame l-stats">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
      <div class="grid">
        ${(c.slide.stats ?? [])
          .map(
            (st, i) => `<div class="cell">
              <div class="v" data-edit="stats.${i}.value">${esc(st.value)}</div>
              <div class="l" data-edit="stats.${i}.label">${esc(st.label)}</div>
              ${st.note ? `<div class="n" data-edit="stats.${i}.note">${esc(st.note)}</div>` : ''}
            </div>`
          )
          .join('')}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  stat: (c) => `<div class="s-frame l-stat">
    ${head(c)}
    <div class="s-body">
      <div class="v" data-edit="stats.0.value">${esc(c.slide.stats?.[0]?.value ?? '')}</div>
      <div class="aside">
        ${edit('title', c.slide.title, 's-title', 'h2')}
        ${edit('body', c.slide.body ?? c.slide.stats?.[0]?.label, 's-text')}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  quote: (c) => `<div class="s-frame l-quote">
    ${head(c)}
    <div class="s-body">
      <div class="mark">&ldquo;</div>
      ${edit('quote.text', c.slide.quote?.text, '', 'blockquote')}
      <div class="who">
        <span class="bar"></span>
        <b data-edit="quote.author">${esc(c.slide.quote?.author)}</b>
        <span data-edit="quote.role">${esc(c.slide.quote?.role)}</span>
      </div>
    </div>
    ${foot(c)}
  </div>`,

  timeline: (c) => `<div class="s-frame l-timeline">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
      <div class="track">
        ${(c.slide.steps ?? [])
          .map(
            (st, i) => `<div class="node">
              <div class="when" data-edit="steps.${i}.when">${esc(st.when ?? `Phase ${i + 1}`)}</div>
              <div class="what" data-edit="steps.${i}.title">${esc(st.title)}</div>
              <div class="desc" data-edit="steps.${i}.text">${esc(st.text)}</div>
            </div>`
          )
          .join('')}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  compare: (c) => `<div class="s-frame l-compare">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
      <div class="duo">
        ${(c.slide.columns ?? [])
          .slice(0, 2)
          .map(
            (col, ci) => `<div class="side" data-tone="${esc(col.tone ?? 'plain')}">
              <h4 data-edit="columns.${ci}.title">${esc(col.title)}</h4>
              <ul>
                ${(col.items ?? [])
                  .map((it, ii) => `<li data-edit="columns.${ci}.items.${ii}">${esc(it)}</li>`)
                  .join('')}
              </ul>
            </div>`
          )
          .join('')}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  process: (c) => `<div class="s-frame l-process">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
      <div class="steps">
        ${(c.slide.steps ?? [])
          .map(
            (st, i) => `<div class="step" data-active="${i === 0 ? 1 : 0}">
              <div class="n" data-edit="steps.${i}.when">${esc(st.when ?? String(i + 1).padStart(2, '0'))}</div>
              <div class="t" data-edit="steps.${i}.title">${esc(st.title)}</div>
              <div class="d" data-edit="steps.${i}.text">${esc(st.text)}</div>
            </div>`
          )
          .join('')}
      </div>
    </div>
    ${foot(c)}
  </div>`,

  chart: (c) => `<div class="s-frame l-chart">
    ${head(c)}
    <div class="s-body">
      <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
      <div class="chart-wrap">
        ${c.slide.chart ? chartSvg(c.slide.chart) : ''}
        <div class="cap">
          <span class="legend"><i></i>${esc(c.slide.chart?.caption ?? '')}</span>
        </div>
      </div>
      ${c.slide.body ? `<div class="insight"><span class="big">↗</span><span data-edit="body">${esc(c.slide.body)}</span></div>` : ''}
    </div>
    ${foot(c)}
  </div>`,

  table: (c) => {
    const t = c.slide.table
    return `<div class="s-frame l-table">
      ${head(c)}
      <div class="s-body">
        <div class="head">${edit('title', c.slide.title, 's-title', 'h2')}</div>
        <table>
          <thead><tr>${(t?.head ?? []).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${(t?.rows ?? [])
              .map(
                (r) =>
                  `<tr>${r
                    .map((cell, ci) => `<td class="${ci === r.length - 1 ? 'hl' : ''}">${esc(cell)}</td>`)
                    .join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>
        ${t?.caption ? `<div class="cap">${esc(t.caption)}</div>` : ''}
      </div>
      ${foot(c)}
    </div>`
  },

  matrix: (c) => {
    const m = c.slide.matrix
    const pts = (m?.items ?? []).map((p, i) => ({
      ...p,
      left: `${Math.min(96, Math.max(4, p.x))}%`,
      top: `${Math.min(94, Math.max(6, 100 - p.y))}%`,
      hi: i === 0 || p.note === 'hi',
    }))
    return `<div class="s-frame l-matrix">
      ${head(c)}
      <div class="s-body">
        <div class="plot">
          <div class="gridline" style="left:50%;top:0;bottom:0;width:1px"></div>
          <div class="gridline" style="top:50%;left:0;right:0;height:1px"></div>
          <span class="axis y">${esc(m?.y ?? '')}</span>
          <span class="axis x">${esc(m?.x ?? '')}</span>
          ${pts
            .map(
              (p) => `<div class="pt" data-hi="${p.hi ? 1 : 0}" style="left:${p.left};top:${p.top}">
                <i></i><span>${esc(p.label)}</span>
              </div>`
            )
            .join('')}
        </div>
        <div class="legend">
          ${edit('title', c.slide.title, 's-title', 'h2')}
          ${(c.slide.bullets ?? [])
            .map(
              (b, i) =>
                `<div class="row"><b data-edit="bullets.${i}.text">${esc(b.text)}</b><span data-edit="bullets.${i}.detail">${esc(b.detail)}</span></div>`
            )
            .join('')}
        </div>
      </div>
      ${foot(c)}
    </div>`
  },

  image: (c) => `<div class="s-frame l-image">
    <div class="bleed"><img src="${esc(c.slide.image?.src)}" alt="${esc(c.slide.image?.alt)}"/></div>
    <div class="scrim"></div>
    <div class="cap">
      ${edit('title', c.slide.title, 's-title', 'h2')}
      ${c.slide.body ? `<div class="src" data-edit="body">${esc(c.slide.body)}</div>` : ''}
    </div>
  </div>`,

  closing: (c) => `<div class="s-frame l-closing">
    ${head(c)}
    <div class="s-body">
      ${edit('title', c.slide.title, 's-hero', 'h2')}
      ${c.slide.subtitle ? edit('subtitle', c.slide.subtitle, 's-lead', 'p') : ''}
      ${c.slide.body ? `<div class="pill">${esc(c.slide.body)}</div>` : ''}
      <div class="contact">
        ${(c.slide.bullets ?? [])
          .map(
            (b, i) =>
              `<span><b data-edit="bullets.${i}.text">${esc(b.text)}</b></span>`
          )
          .join('')}
      </div>
    </div>
    ${foot(c, { number: false })}
  </div>`,
}

/* ============================ entry ============================ */

export function renderSlide(slide: Slide, deck: Deck, index: number, total: number): HTMLElement {
  const theme = getTheme(deck.theme)
  const el = document.createElement('div')
  el.className = `slide l-${slide.type}`
  el.dataset.theme = theme.id
  el.dataset.deco = theme.deco
  el.dataset.slideId = slide.id
  el.dataset.type = slide.type

  const vars = themeVars(theme, deck.settings)
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  el.style.setProperty('--fit', '1')

  const layout = L[slide.type] ?? L.bullets
  el.innerHTML = `<div class="deco"></div>${layout({ slide, deck, index, total })}`
  return el
}

/**
 * Progressive type-down. If the composed slide exceeds its frame, the
 * type scale is reduced until the content sits inside the box. This is
 * what keeps an arbitrary model output from colliding with the eyebrow.
 * Must be called after the element is attached and laid out.
 */
export function autofit(el: HTMLElement): void {
  const frame = el.querySelector('.s-frame') as HTMLElement | null
  if (!frame) return
  const body = el.querySelector('.s-body') as HTMLElement | null

  const overflow = (): number => {
    let amount = frame.scrollHeight - frame.clientHeight
    if (body) {
      amount = Math.max(amount, body.scrollHeight - body.clientHeight)
      const top = body.getBoundingClientRect().top
      for (const child of Array.from(body.children)) {
        const ct = child.getBoundingClientRect().top
        if (ct < top - 0.5) amount = Math.max(amount, top - ct + 2)
      }
    }
    return Math.max(0, amount)
  }

  el.style.setProperty('--fit', '1')
  let k = 1
  let prev = Infinity
  for (let i = 0; i < 20; i++) {
    const over = overflow()
    if (over <= 2) break
    if (over >= prev - 0.5) break
    prev = over
    k -= 0.035
    if (k < 0.62) break
    el.style.setProperty('--fit', String(Math.round(k * 1000) / 1000))
  }
}

export function slideLabel(s: Slide): string {
  return s.title?.trim() || prettyType(s.type)
}

export function prettyType(t: string): string {
  const map: Record<string, string> = {
    title: 'Title',
    section: 'Section',
    statement: 'Statement',
    bullets: 'Key points',
    split: 'Text + visual',
    stats: 'Metrics row',
    stat: 'Hero number',
    quote: 'Quote',
    timeline: 'Timeline',
    compare: 'Comparison',
    process: 'Process',
    chart: 'Chart',
    table: 'Table',
    matrix: '2×2 matrix',
    image: 'Full image',
    closing: 'Closing',
  }
  return map[t] ?? t
}

export const initialsOf = initials
