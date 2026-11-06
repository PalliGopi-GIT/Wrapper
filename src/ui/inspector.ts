import { store, getPath, setPath } from '../store'
import { THEMES, getTheme } from '../design/themes'
import { icon } from './icons'
import { escapeHtml as esc } from './dom'
import { deckOperation } from './ai-actions'
import { SLIDE_TYPES } from './rail'
import type { Slide, SlideType } from '../model/types'

let bodyEl: HTMLElement
let tabsEl: HTMLElement

export function mountInspector(root: HTMLElement) {
  root.innerHTML = `
    <div class="insp-tabs">
      <button data-tab="content">Content</button>
      <button data-tab="layout">Layout</button>
      <button data-tab="design">Design</button>
      <button data-tab="notes">Notes</button>
    </div>
    <div class="insp-body"></div>`
  bodyEl = root.querySelector('.insp-body') as HTMLElement
  tabsEl = root.querySelector('.insp-tabs') as HTMLElement
  tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      store.ui.tab = b.dataset.tab as typeof store.ui.tab
      store.emit('ui')
    })
  })
}

const attr = (s: string) => esc(s).replace(/"/g, '&quot;')

function bind(root: HTMLElement) {
  const slide = store.slide
  if (!slide) return
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-path]').forEach((inp) => {
    inp.addEventListener('focus', () => store.snapshot(), { once: true })
    inp.addEventListener('input', () => {
      const path = inp.dataset.path
      if (!path) return
      const raw = inp instanceof HTMLInputElement && inp.type === 'number' ? Number(inp.value) : inp.value
      setPath(slide, path, raw)
      store.deck.updatedAt = Date.now()
      store.emit('inline')
    })
  })
}

function field(label: string, control: string, hint?: string): string {
  return `<div class="field"><label>${esc(label)}</label>${control}${
    hint ? `<div class="dim" style="font-size:10px;margin-top:4px">${esc(hint)}</div>` : ''
  }</div>`
}

function textField(slide: Slide, label: string, path: string, opts: { multiline?: boolean; placeholder?: string } = {}) {
  const value = String(getPath(slide, path) ?? '')
  const ph = opts.placeholder ? `placeholder="${attr(opts.placeholder)}"` : ''
  return field(
    label,
    opts.multiline
      ? `<textarea class="textarea" data-path="${path}" ${ph}>${esc(value)}</textarea>`
      : `<input class="input" data-path="${path}" value="${attr(value)}" ${ph}>`
  )
}

/* ------------------------------- content ------------------------------- */

function contentTab(): string {
  const slide = store.slide
  if (!slide) return empty('Select a slide to edit its content.')
  let html = ''

  const t = slide.type
  if (t !== 'quote') {
    if (t !== 'closing' && t !== 'section') html += textField(slide, 'Eyebrow', 'eyebrow', { placeholder: 'Optional label above the title' })
  }

  if (t === 'quote') {
    html += textField(slide, 'Quote', 'quote.text', { multiline: true })
    html += `<div class="row">${textField(slide, 'Author', 'quote.author')}${textField(slide, 'Role', 'quote.role')}</div>`
    return html
  }

  html += textField(slide, t === 'title' ? 'Title' : 'Headline', 'title', {
    multiline: t === 'statement' || t === 'closing' || t === 'title',
  })

  if (t === 'title' || t === 'section' || t === 'statement' || t === 'closing' || t === 'image') {
    html += textField(slide, t === 'closing' ? 'Subline' : 'Subtitle', 'subtitle', { multiline: true })
  }

  if (t === 'bullets' || t === 'split' || t === 'stat' || t === 'chart' || t === 'image') {
    html += textField(slide, t === 'chart' ? 'Insight line' : 'Body', 'body', { multiline: true })
  }

  if (t === 'bullets' || t === 'split') {
    html += bulletsEditor(slide)
  }

  if (t === 'stats' || t === 'stat') {
    html += statsEditor(slide)
  }

  if (t === 'timeline' || t === 'process') {
    html += stepsEditor(slide)
  }

  if (t === 'compare') {
    html += compareEditor(slide)
  }

  if (t === 'chart') {
    html += chartEditor(slide)
  }

  if (t === 'table') {
    html += tableEditor(slide)
  }

  if (t === 'matrix') {
    html += matrixEditor(slide)
  }

  if (t === 'image') {
    html += textField(slide, 'Image URL', 'image.src')
    html += textField(slide, 'Caption', 'body')
  }

  if (t === 'closing') {
    html += textField(slide, 'CTA label', 'body', { placeholder: 'Start a deck' })
    html += bulletsEditor(slide, 'Contact lines')
  }

  return html
}

function listHeader(label: string, count: number) {
  return `<div class="sec-head" style="margin-bottom:8px"><h3>${esc(label)}</h3><span class="hint">${count}</span></div>`
}

function bulletsEditor(slide: Slide, label = 'Points'): string {
  const items = slide.bullets ?? []
  return `<div class="sec">
    ${listHeader(label, items.length)}
    <div class="list-edit">
      ${items
        .map(
          (b, i) => `<div class="list-row">
            <span class="handle">${i + 1}</span>
            <div class="fields">
              <input class="input" data-path="bullets.${i}.text" value="${attr(b.text)}" placeholder="Claim">
              ${slide.type !== 'closing' ? `<input class="input" style="margin-top:4px" data-path="bullets.${i}.detail" value="${attr(b.detail ?? '')}" placeholder="Supporting detail">` : ''}
            </div>
            <button class="rm" data-remove="bullet:${i}">${icon('x', 12)}</button>
          </div>`
        )
        .join('')}
    </div>
    <button class="add-row" style="margin-top:6px" data-add="bullet">+ Add point</button>
  </div>`
}

function statsEditor(slide: Slide): string {
  const items = slide.stats ?? []
  return `<div class="sec">
    ${listHeader('Metrics', items.length)}
    <div class="list-edit">
      ${items
        .map(
          (s, i) => `<div class="list-row">
            <div class="fields">
              <div class="row">
                <input class="input" style="max-width:76px" data-path="stats.${i}.value" value="${attr(s.value)}" placeholder="42%">
                <input class="input" data-path="stats.${i}.label" value="${attr(s.label)}" placeholder="What it measures">
              </div>
              <input class="input" style="margin-top:4px" data-path="stats.${i}.note" value="${attr(s.note ?? '')}" placeholder="Source or caveat (optional)">
            </div>
            <button class="rm" data-remove="stat:${i}">${icon('x', 12)}</button>
          </div>`
        )
        .join('')}
    </div>
    <button class="add-row" style="margin-top:6px" data-add="stat">+ Add metric</button>
  </div>`
}

function stepsEditor(slide: Slide): string {
  const items = slide.steps ?? []
  return `<div class="sec">
    ${listHeader(slide.type === 'timeline' ? 'Milestones' : 'Steps', items.length)}
    <div class="list-edit">
      ${items
        .map(
          (s, i) => `<div class="list-row">
            <div class="fields">
              <div class="row">
                <input class="input" style="max-width:76px" data-path="steps.${i}.when" value="${attr(s.when ?? '')}" placeholder="Q1">
                <input class="input" data-path="steps.${i}.title" value="${attr(s.title)}" placeholder="Name">
              </div>
              <input class="input" style="margin-top:4px" data-path="steps.${i}.text" value="${attr(s.text ?? '')}" placeholder="One line of detail">
            </div>
            <button class="rm" data-remove="step:${i}">${icon('x', 12)}</button>
          </div>`
        )
        .join('')}
    </div>
    <button class="add-row" style="margin-top:6px" data-add="step">+ Add ${slide.type === 'timeline' ? 'milestone' : 'step'}</button>
  </div>`
}

function compareEditor(slide: Slide): string {
  const cols = slide.columns ?? []
  return `<div class="sec">
    ${listHeader('Columns', cols.length)}
    ${cols
      .map(
        (c, i) => `<div class="field">
          <div class="row">
            <input class="input" data-path="columns.${i}.title" value="${attr(c.title)}" placeholder="Column title">
          </div>
          <textarea class="textarea" style="margin-top:4px;min-height:80px" data-path="columns.${i}.items" data-join="1" placeholder="One item per line">${esc(
            (c.items ?? []).join('\n')
          )}</textarea>
        </div>`
      )
      .join('')}
    <div class="dim" style="font-size:10px">One item per line. The right column is accented.</div>
  </div>`
}

function chartEditor(slide: Slide): string {
  const ch = slide.chart
  if (!ch) return ''
  return `<div class="sec">
    ${listHeader('Chart', ch.data.length)}
    ${field(
      'Type',
      `<div class="seg">${(['column', 'area', 'line', 'bar', 'donut'] as const)
        .map((k) => `<button data-chartkind="${k}" class="${ch.kind === k ? 'on' : ''}">${k}</button>`)
        .join('')}</div>`
    )}
    <div class="list-edit">
      ${ch.data
        .map(
          (d, i) => `<div class="list-row">
            <div class="fields"><div class="row">
              <input class="input" data-path="chart.data.${i}.label" value="${attr(d.label)}" placeholder="Label">
              <input class="input" style="max-width:80px" type="number" data-path="chart.data.${i}.value" value="${d.value}" placeholder="0">
            </div></div>
            <button class="rm" data-remove="datum:${i}">${icon('x', 12)}</button>
          </div>`
        )
        .join('')}
    </div>
    <button class="add-row" style="margin-top:6px" data-add="datum">+ Add data point</button>
    ${textField(slide, 'Caption', 'chart.caption')}
    ${textField(slide, 'Value suffix', 'chart.suffix', { placeholder: '%' })}
  </div>`
}

function tableEditor(slide: Slide): string {
  const t = slide.table
  if (!t) return ''
  return `<div class="sec">
    ${listHeader('Table', t.rows.length)}
    ${field('Columns', `<input class="input" data-tablehead value="${attr(t.head.join(', '))}" placeholder="A, B, C">`)}
    ${field(
      'Rows',
      `<textarea class="textarea" style="min-height:110px" data-tablerows>${esc(
        t.rows.map((r) => r.join(' | ')).join('\n')
      )}</textarea>`,
      'One row per line, cells separated by |'
    )}
  </div>`
}

function matrixEditor(slide: Slide): string {
  const m = slide.matrix
  if (!m) return ''
  return `<div class="sec">
    <div class="row">
      ${textField(slide, 'X axis', 'matrix.x')}
      ${textField(slide, 'Y axis', 'matrix.y')}
    </div>
    ${listHeader('Points', m.items.length)}
    <div class="list-edit">
      ${m.items
        .map(
          (p, i) => `<div class="list-row">
            <div class="fields">
              <input class="input" data-path="matrix.items.${i}.label" value="${attr(p.label)}" placeholder="Name">
              <div class="row" style="margin-top:4px">
                <input class="input" type="number" min="0" max="100" data-path="matrix.items.${i}.x" value="${p.x}" placeholder="x">
                <input class="input" type="number" min="0" max="100" data-path="matrix.items.${i}.y" value="${p.y}" placeholder="y">
              </div>
            </div>
            <button class="rm" data-remove="point:${i}">${icon('x', 12)}</button>
          </div>`
        )
        .join('')}
    </div>
    <button class="add-row" style="margin-top:6px" data-add="point">+ Add point</button>
  </div>`
}

/* ------------------------------- layout ------------------------------- */

function layoutTab(): string {
  const slide = store.slide
  if (!slide) return empty('Select a slide to change its layout.')
  const variants = VARIANTS[slide.type] ?? []
  return `
    <div class="sec">
      <div class="sec-head"><h3>Slide type</h3></div>
      <div class="slide-types">
        ${SLIDE_TYPES.map(
          (t) => `<button class="type-btn" data-settype="${t.type}">
            ${icon(t.icon, 12)} ${esc(t.label)}
          </button>`
        ).join('')}
      </div>
    </div>
    ${
      variants.length
        ? `<div class="sec">
      <div class="sec-head"><h3>Variant</h3></div>
      <div class="seg">
        ${variants
          .map(
            (v) => `<button data-variant="${v.id}" class="${(slide.variant ?? variants[0].id) === v.id ? 'on' : ''}">${esc(v.label)}</button>`
          )
          .join('')}
      </div>
    </div>`
        : ''
    }
    <div class="sec">
      <div class="sec-head"><h3>This slide</h3></div>
      <div class="row">
        <button class="btn sm" data-act="dup">${icon('copy', 12)} Duplicate</button>
        <button class="btn sm" data-act="up">${icon('chevronLeft', 12)} Move up</button>
      </div>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" data-act="down">Move down ${icon('chevronRight', 12)}</button>
        <button class="btn sm" data-act="del" style="color:var(--ui-danger)">${icon('trash', 12)} Delete</button>
      </div>
    </div>`
}

const VARIANTS: Partial<Record<SlideType, { id: string; label: string }[]>> = {
  title: [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Center' },
    { id: 'rule', label: 'Rule' },
  ],
  bullets: [
    { id: 'numbered', label: 'Numbered' },
    { id: 'cards', label: 'Cards' },
    { id: 'two', label: 'Two col' },
    { id: 'plain', label: 'Plain' },
  ],
  split: [
    { id: 'right', label: 'Panel right' },
    { id: 'flip', label: 'Panel left' },
  ],
}

/* ------------------------------- design ------------------------------- */

function designTab(): string {
  const s = store.deck.settings
  return `
    <div class="sec">
      <div class="sec-head"><h3>Design system</h3><span class="hint">${THEMES.length}</span></div>
      <div class="theme-grid">
        ${THEMES.map(
          (t) => `<button class="theme-card ${store.deck.theme === t.id ? 'on' : ''}" data-theme="${t.id}" title="${esc(t.blurb)}">
            <div class="sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
            <div class="nm">${esc(t.name)}</div>
            <div class="md">${t.mode === 'dark' ? 'Dark' : 'Light'} · ${esc(t.deco)}</div>
          </button>`
        ).join('')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Accent</h3>${s.accent ? `<button class="btn ghost sm" data-resetaccent>Reset</button>` : ''}</div>
      <div class="row">
        <input type="color" class="input" style="height:30px;padding:3px;max-width:64px" data-accent value="${s.accent ?? getTheme(store.deck.theme).color.accent}">
        <div class="seg" style="flex:2">
          ${THEMES.slice(0, 3)
            .map((t) => `<button data-quickaccent="${t.color.accent}" class="dim">${esc(t.name)}</button>`)
            .join('')}
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Type scale</h3><span class="range-val">${Math.round(s.scale * 100)}%</span></div>
      <input class="range" type="range" min="88" max="118" value="${Math.round(s.scale * 100)}" data-slider="scale">
    </div>
    <div class="sec">
      <div class="sec-head"><h3>Density</h3><span class="range-val">${Math.round(s.density * 100)}%</span></div>
      <input class="range" type="range" min="85" max="120" value="${Math.round(s.density * 100)}" data-slider="density">
    </div>
    <div class="sec">
      <div class="sec-head"><h3>Corners</h3><span class="range-val">${s.radius < 0 ? 'theme' : `${s.radius}px`}</span></div>
      <input class="range" type="range" min="0" max="28" value="${s.radius < 0 ? 0 : s.radius}" data-slider="radius">
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Chrome</h3></div>
      <div class="seg">
        <button data-toggle="showFooter" class="${s.showFooter ? 'on' : ''}">Footer</button>
        <button data-toggle="showNumbers" class="${s.showNumbers ? 'on' : ''}">Numbers</button>
      </div>
      <div class="field" style="margin-top:8px">
        <label>Brand line</label>
        <input class="input" data-brand value="${attr(s.brand)}" placeholder="Shown in the footer">
      </div>
    </div>

    <div class="sec">
      <div class="sec-head"><h3>Whole deck</h3><span class="hint">uses the model</span></div>
      <div class="list-edit">
        <button class="btn sm block" data-op="Tighten the entire deck. Remove any slide that does not advance the argument, and make every title a claim under nine words.">${icon('sparkle', 12)} Tighten the argument</button>
        <button class="btn sm block" data-op="Rewrite the deck for a more skeptical, senior audience. Add evidence and remove adjectives.">${icon('sparkle', 12)} Raise the register</button>
        <button class="btn sm block" data-op="Restructure the narrative so the strongest proof arrives earlier, without changing the total slide count.">${icon('sparkle', 12)} Restructure story</button>
        <button class="btn sm block" data-op="Cut the deck by a third. Keep the spine intact and merge related slides.">${icon('sparkle', 12)} Shorten by a third</button>
      </div>
    </div>`
}

/* ------------------------------- notes ------------------------------- */

function notesTab(): string {
  const slide = store.slide
  if (!slide) return empty('Select a slide to write speaker notes.')
  const words = (slide.notes ?? '').trim().split(/\s+/).filter(Boolean).length
  return `
    <div class="sec">
      <div class="sec-head"><h3>Speaker notes</h3><span class="hint">${words} words · ~${Math.max(
        1,
        Math.round((words / 130) * 60)
      )}s</span></div>
      <textarea class="textarea" style="min-height:180px" data-notes placeholder="What you will actually say — not a summary of the slide.">${esc(
        slide.notes ?? ''
      )}</textarea>
      <div class="dim" style="font-size:10.5px;line-height:1.6;margin-top:8px">
        Notes are private to presenter view and are included in PDF, PNG and Markdown exports.
      </div>
    </div>
    <div class="sec">
      <div class="sec-head"><h3>Slide</h3></div>
      ${textField(slide, 'Headline', 'title', { multiline: true })}
    </div>`
}

function empty(msg: string): string {
  return `<div class="empty-state"><h3>Nothing selected</h3><p>${esc(msg)}</p></div>`
}

/* ------------------------------- render ------------------------------- */

export function renderInspector() {
  if (!bodyEl) return
  tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === store.ui.tab)
  })

  const html =
    store.ui.tab === 'content'
      ? contentTab()
      : store.ui.tab === 'layout'
        ? layoutTab()
        : store.ui.tab === 'design'
          ? designTab()
          : notesTab()

  bodyEl.innerHTML = html
  bind(bodyEl)
  wire(bodyEl)
}

function wire(root: HTMLElement) {
  const slide = store.slide

  root.querySelector('[data-notes]')?.addEventListener('input', (e) => {
    if (!slide) return
    slide.notes = (e.target as HTMLTextAreaElement).value
    store.emit('inline')
  })

  root.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = (btn as HTMLElement).dataset.add
      store.mutate((d) => {
        const s = d.slides.find((x) => x.id === store.ui.selectedId)
        if (!s) return
        if (kind === 'bullet') {
          s.bullets = [...(s.bullets ?? []), { text: '' }]
        } else if (kind === 'stat') {
          s.stats = [...(s.stats ?? []), { value: '', label: '' }]
        } else if (kind === 'step') {
          s.steps = [...(s.steps ?? []), { title: '', text: '', when: '' }]
        } else if (kind === 'datum') {
          if (s.chart) s.chart.data = [...s.chart.data, { label: '', value: 0 }]
        } else if (kind === 'point') {
          if (s.matrix) s.matrix.items = [...s.matrix.items, { label: '', x: 50, y: 50 }]
        }
      })
    })
  })

  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [kind, idxRaw] = ((btn as HTMLElement).dataset.remove ?? '').split(':')
      const idx = Number(idxRaw)
      store.mutate((d) => {
        const s = d.slides.find((x) => x.id === store.ui.selectedId)
        if (!s) return
        if (kind === 'bullet') s.bullets = (s.bullets ?? []).filter((_, i) => i !== idx)
        if (kind === 'stat') s.stats = (s.stats ?? []).filter((_, i) => i !== idx)
        if (kind === 'step') s.steps = (s.steps ?? []).filter((_, i) => i !== idx)
        if (kind === 'datum' && s.chart) s.chart.data = s.chart.data.filter((_, i) => i !== idx)
        if (kind === 'point' && s.matrix) s.matrix.items = s.matrix.items.filter((_, i) => i !== idx)
      })
    })
  })

  root.querySelectorAll('[data-settype]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.settype as SlideType
      if (!slide) return
      store.mutate((d) => {
        const s = d.slides.find((x) => x.id === slide.id)
        if (!s) return
        const converted = convertSlide(s, type)
        Object.assign(s, converted)
      })
    })
  })

  root.querySelectorAll('[data-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = (btn as HTMLElement).dataset.variant
      if (slide) store.updateSlide(slide.id, { variant: v })
    })
  })

  root.querySelectorAll('[data-chartkind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = (btn as HTMLElement).dataset.chartkind as 'area'
      if (!slide?.chart) return
      store.mutate((d) => {
        const s = d.slides.find((x) => x.id === slide.id)
        if (s?.chart) s.chart.kind = kind
      })
    })
  })

  root.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const act = (btn as HTMLElement).dataset.act
      if (!slide) return
      const i = store.slideIndex
      if (act === 'dup') store.duplicateSlide(slide.id)
      if (act === 'del') store.removeSlide(slide.id)
      if (act === 'up' && i > 0) store.moveSlide(i, i - 1)
      if (act === 'down' && i < store.deck.slides.length - 1) store.moveSlide(i, i + 2)
    })
  })

  root.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.theme
      if (!id) return
      store.mutate((d) => {
        d.theme = id
        d.settings.accent = null
        d.settings.radius = -1
      }, { kind: 'theme' })
    })
  })

  const accent = root.querySelector('[data-accent]') as HTMLInputElement | null
  accent?.addEventListener('focus', () => store.snapshot(), { once: true })
  accent?.addEventListener('input', () => store.patchSettings({ accent: accent.value }))
  accent?.addEventListener('change', () => store.emit('theme'))
  root.querySelector('[data-resetaccent]')?.addEventListener('click', () => store.patchSettings({ accent: null }))
  root.querySelectorAll('[data-quickaccent]').forEach((b) =>
    b.addEventListener('click', () =>
      store.patchSettings({ accent: (b as HTMLElement).dataset.quickaccent ?? null })
    )
  )

  root.querySelectorAll<HTMLInputElement>('[data-slider]').forEach((rng) => {
    rng.addEventListener('focus', () => store.snapshot(), { once: true })
    rng.addEventListener('input', () => {
      const key = rng.dataset.slider as 'scale' | 'density' | 'radius'
      const v = Number(rng.value)
      store.patchSettings(
        key === 'scale' ? { scale: v / 100 } : key === 'density' ? { density: v / 100 } : { radius: v }
      )
      const val = rng.closest('.sec')?.querySelector('.range-val')
      if (val) val.textContent = rng.dataset.slider === 'radius' ? `${v}px` : `${v}%`
    })
  })

  root.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = b as HTMLElement
      const key = el.dataset.toggle as 'showFooter' | 'showNumbers'
      const next = !store.deck.settings[key]
      store.patchSettings({ [key]: next })
      el.classList.toggle('on', next)
    })
  )

  const brand = root.querySelector('[data-brand]') as HTMLInputElement | null
  brand?.addEventListener('focus', () => store.snapshot(), { once: true })
  brand?.addEventListener('input', () => store.patchSettings({ brand: brand.value }))

  root.querySelectorAll('[data-op]').forEach((b) =>
    b.addEventListener('click', () => {
      const instruction = (b as HTMLElement).dataset.op ?? ''
      void deckOperation(instruction)
    })
  )

  // table editors
  const head = root.querySelector('[data-tablehead]') as HTMLInputElement | null
  head?.addEventListener('focus', () => store.snapshot(), { once: true })
  head?.addEventListener('input', () => {
    if (!slide) return
    slide.table = {
      head: head.value.split(',').map((s) => s.trim()).filter(Boolean),
      rows: slide.table?.rows ?? [],
      caption: slide.table?.caption,
    }
    store.emit('inline')
  })
  const rows = root.querySelector('[data-tablerows]') as HTMLTextAreaElement | null
  rows?.addEventListener('focus', () => store.snapshot(), { once: true })
  rows?.addEventListener('input', () => {
    if (!slide) return
    slide.table = {
      head: slide.table?.head ?? [],
      rows: rows.value
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => l.split('|').map((c) => c.trim())),
      caption: slide.table?.caption,
    }
    store.emit('inline')
  })

  // join/split multi-line items (compare columns)
  root.querySelectorAll<HTMLTextAreaElement>('[data-join]').forEach((ta) => {
    ta.addEventListener('focus', () => store.snapshot(), { once: true })
    ta.addEventListener('input', () => {
      const path = ta.dataset.path
      if (!path || !slide) return
      setPath(
        slide,
        path,
        ta.value.split('\n').map((l) => l.trim()).filter(Boolean)
      )
      store.emit('inline')
    })
  })
}

function convertSlide(s: Slide, type: SlideType): Partial<Slide> {
  const keep: Partial<Slide> = { type, title: s.title, eyebrow: s.eyebrow, body: s.body, notes: s.notes }
  if (type === 'quote' && !s.quote) return { ...keep, quote: { text: s.body || s.title || '', author: '', role: '' } }
  if ((type === 'timeline' || type === 'process') && !s.steps?.length)
    return { ...keep, steps: (s.bullets ?? []).map((b) => ({ title: b.text, text: b.detail, when: '' })) }
  if (type === 'compare' && !s.columns?.length)
    return {
      ...keep,
      columns: [
        { title: 'Before', tone: 'muted', items: (s.bullets ?? []).slice(0, 3).map((b) => b.text) },
        { title: 'After', tone: 'accent', items: [] },
      ],
    }
  if ((type === 'stats' || type === 'stat') && !s.stats?.length)
    return { ...keep, stats: [{ value: '', label: s.body ?? '' }] }
  if (type === 'chart' && !s.chart)
    return {
      ...keep,
      chart: { kind: 'column', data: [{ label: 'A', value: 40 }, { label: 'B', value: 65 }, { label: 'C', value: 82 }], caption: '' },
    }
  if (type === 'table' && !s.table)
    return {
      ...keep,
      table: { head: ['Criterion', 'Option A', 'Option B'], rows: [['', '', ''], ['', '', '']] },
    }
  if (type === 'matrix' && !s.matrix)
    return { ...keep, matrix: { x: 'X', y: 'Y', items: [{ label: 'You', x: 75, y: 78 }] } }
  if (type === 'image' && !s.image)
    return {
      ...keep,
      image: { src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80', alt: '' },
    }
  if (type === 'bullets' && !s.bullets?.length)
    return { ...keep, bullets: [{ text: s.title ?? 'First point', detail: '' }, { text: 'Second point', detail: '' }] }
  return keep
}

export function refreshInspectorIfIdle() {
  if (bodyEl.contains(document.activeElement)) return
  renderInspector()
}
