import { store, setPath } from '../store'
import { renderSlide, prettyType, autofit } from '../render/slide'
import { icon } from './icons'
import { el, toast } from './dom'
import { rewriteSlide } from './ai-actions'

let stage: HTMLElement
let slideRoot: HTMLElement | null = null
let scroller: HTMLElement
let bar: HTMLElement
let editing: HTMLElement | null = null
let floatBar: HTMLElement | null = null
let scale = 1

export function mountCanvas(root: HTMLElement) {
  root.innerHTML = `
    <div class="canvas-scroll">
      <div class="canvas-stage"></div>
    </div>
    <div class="canvas-bar">
      <button class="icon-btn" data-nav="prev" title="Previous slide">${icon('chevronLeft', 14)}</button>
      <button class="icon-btn" data-nav="next" title="Next slide">${icon('chevronRight', 14)}</button>
      <span class="mid" data-mid></span>
      <span class="zoom">
        <button data-zoom="out" title="Zoom out">−</button>
        <span class="val" data-zoomval>100%</span>
        <button data-zoom="in" title="Zoom in">+</button>
        <button data-zoom="fit" title="Fit to window">${icon('fullscreen', 12)}</button>
      </span>
    </div>`

  scroller = root.querySelector('.canvas-scroll') as HTMLElement
  stage = root.querySelector('.canvas-stage') as HTMLElement
  bar = root.querySelector('.canvas-bar') as HTMLElement

  stage.addEventListener('mousedown', (e) => {
    const target = (e.target as HTMLElement).closest('[data-edit]') as HTMLElement | null
    if (!target) {
      if (editing) editing.blur()
      return
    }
    if (target === editing) return
    if (editing) editing.blur()
    beginEdit(target, e)
  })

  stage.addEventListener('keydown', (e) => {
    if (!editing) return
    const ke = e as KeyboardEvent
    if (ke.key === 'Escape') {
      ke.preventDefault()
      editing.blur()
    }
    if (ke.key === 'Enter' && !ke.shiftKey) {
      ke.preventDefault()
      editing.blur()
    }
  })

  stage.addEventListener('paste', (e) => {
    if (!editing) return
    e.preventDefault()
    const text = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? ''
    document.execCommand('insertText', false, text.replace(/\s+/g, ' '))
  })

  bar.querySelector('[data-nav="prev"]')?.addEventListener('click', () => step(-1))
  bar.querySelector('[data-nav="next"]')?.addEventListener('click', () => step(1))
  bar.querySelector('[data-zoom="in"]')?.addEventListener('click', () => setZoom(Math.min(1.6, scale + 0.1)))
  bar.querySelector('[data-zoom="out"]')?.addEventListener('click', () => setZoom(Math.max(0.3, scale - 0.1)))
  bar.querySelector('[data-zoom="fit"]')?.addEventListener('click', () => {
    store.ui.zoom = 'fit'
    store.emit('ui')
    fit()
  })

  new ResizeObserver(() => fit()).observe(scroller)
  document.addEventListener('scroll', hideFloat, true)
  scroller.addEventListener('scroll', hideFloat)
}

export function step(dir: number) {
  const i = store.slideIndex
  const next = store.deck.slides[i + dir]
  if (next) store.select(next.id)
}

function currentScale(): number {
  if (typeof store.ui.zoom === 'number') return store.ui.zoom
  const availW = scroller.clientWidth - 88
  const availH = scroller.clientHeight - 80
  return Math.max(0.3, Math.min(availW / 1280, availH / 720, 1.25))
}

function fit() {
  size()
}

function setZoom(v: number) {
  store.ui.zoom = Math.round(v * 100) / 100
  store.emit('ui')
  size()
}

function size() {
  if (!slideRoot) return
  scale = currentScale()
  stage.style.width = `${1280 * scale}px`
  stage.style.height = `${720 * scale}px`
  slideRoot.style.transform = `scale(${scale})`
  const zv = bar.querySelector('[data-zoomval]')
  if (zv) zv.textContent = `${Math.round(scale * 100)}%`
}

export function renderCanvas() {
  const deck = store.deck
  const slide = store.slide
  const idx = store.slideIndex

  const mid = bar.querySelector('[data-mid]')
  if (mid)
    mid.textContent = slide
      ? `${String(idx + 1).padStart(2, '0')} / ${String(deck.slides.length).padStart(2, '0')}  ·  ${prettyType(slide.type)}`
      : ''

  if (!slide) {
    stage.innerHTML = `<div class="empty-state" style="height:100%">
      <h3>No slide selected</h3>
      <p>Add a slide from the left rail, or press ⌘K to compose a deck.</p>
    </div>`
    slideRoot = null
    return
  }

  const node = renderSlide(slide, deck, idx, deck.slides.length)
  node.classList.add('canvas-editing')
  node.style.transformOrigin = '0 0'
  stage.replaceChildren(node)
  slideRoot = node
  autofit(node)
  size()

  if (store.ui.generating) showGenerating()
}

function showGenerating() {
  if (stage.querySelector('.gen-shade')) return
  stage.appendChild(
    el<HTMLDivElement>(`<div class="gen-shade">
      <div class="gen-card">
        <div class="spin"></div>
        <div class="lbl">${escape(store.ui.generatingLabel || 'Composing')}</div>
        <div class="sub">Structure, then type, then emphasis</div>
      </div>
    </div>`)
  )
}

function escape(s: string) {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
}

/* ------------------------------- editing ------------------------------- */

function beginEdit(node: HTMLElement, ev: MouseEvent) {
  const path = node.dataset.edit
  if (!path) return
  editing = node
  store.snapshot()
  node.setAttribute('contenteditable', 'true')
  node.focus()

  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
  const range = doc.caretRangeFromPoint?.(ev.clientX, ev.clientY)
  if (range) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  const onBlur = () => {
    const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    node.removeAttribute('contenteditable')
    const slide = store.slide
    if (slide) {
      setPath(slide, path, value)
      store.deck.updatedAt = Date.now()
      store.emit('inline')
    }
    if (editing === node) editing = null
    hideFloat()
  }
  node.addEventListener('blur', onBlur, { once: true })
  showFloat(node)
}

function showFloat(node: HTMLElement) {
  hideFloat()
  const rect = node.getBoundingClientRect()
  const barEl = el<HTMLDivElement>(`<div class="float-bar">
    <button data-ai>${icon('sparkle', 12)} Rewrite</button>
    <button data-copy>${icon('copy', 12)}</button>
  </div>`)
  barEl.style.position = 'fixed'
  barEl.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 240))}px`
  barEl.style.top = `${Math.max(10, rect.top - 36)}px`
  document.body.appendChild(barEl)
  floatBar = barEl

  barEl.querySelector('[data-ai]')?.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const slideId = store.slide?.id
    if (slideId) askInline(barEl, slideId)
  })
  barEl.querySelector('[data-copy]')?.addEventListener('mousedown', async (e) => {
    e.preventDefault()
    await navigator.clipboard.writeText(node.textContent ?? '')
    toast('Copied')
  })
}

function askInline(anchor: HTMLElement, slideId: string) {
  hideFloat()
  const rect = anchor.getBoundingClientRect()
  const box = el<HTMLDivElement>(`<div class="float-bar" style="padding:6px;gap:6px">
    <input class="input" style="height:26px;width:250px;padding:0 8px" placeholder="e.g. make it shorter and more concrete" />
    <button class="btn accent sm" data-go>Rewrite</button>
  </div>`)
  box.style.position = 'fixed'
  box.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 360))}px`
  box.style.top = `${Math.max(10, rect.top - 42)}px`
  document.body.appendChild(box)
  floatBar = box
  const input = box.querySelector('input') as HTMLInputElement
  input.focus()

  const go = () => {
    const instruction = input.value.trim() || 'Tighten this slide and make the language more concrete.'
    hideFloat()
    void rewriteSlide(slideId, instruction)
  }
  box.querySelector('[data-go]')?.addEventListener('click', go)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go()
    if (e.key === 'Escape') hideFloat()
  })
}

export function hideFloat() {
  floatBar?.remove()
  floatBar = null
}

export function refreshScale() {
  size()
}
