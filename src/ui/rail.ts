import { store } from '../store'
import { renderSlide, prettyType } from '../render/slide'
import { newSlide } from '../model/slides'
import { icon } from './icons'
import { el, popover, confirmDialog, type MenuItem } from './dom'
import type { SlideType } from '../model/types'

const THUMB_W = 172

export const SLIDE_TYPES: { type: SlideType; label: string; icon: keyof typeof import('./icons').icons }[] = [
  { type: 'title', label: 'Title', icon: 'title' },
  { type: 'statement', label: 'Statement', icon: 'statement' },
  { type: 'bullets', label: 'Key points', icon: 'list' },
  { type: 'split', label: 'Text + visual', icon: 'split' },
  { type: 'stats', label: 'Metrics row', icon: 'stat' },
  { type: 'stat', label: 'Hero number', icon: 'chart' },
  { type: 'chart', label: 'Chart', icon: 'chart' },
  { type: 'compare', label: 'Comparison', icon: 'compare' },
  { type: 'process', label: 'Process', icon: 'process' },
  { type: 'timeline', label: 'Timeline', icon: 'timeline' },
  { type: 'table', label: 'Table', icon: 'table' },
  { type: 'matrix', label: '2×2 matrix', icon: 'grid' },
  { type: 'quote', label: 'Quote', icon: 'quote' },
  { type: 'image', label: 'Full image', icon: 'imageBig' },
  { type: 'section', label: 'Section divider', icon: 'section' },
  { type: 'closing', label: 'Closing', icon: 'closing' },
]

let listEl: HTMLElement
let rootEl: HTMLElement

export function mountRail(root: HTMLElement) {
  rootEl = root
  root.innerHTML = `
    <div class="rail-head">
      <span class="label">Slides</span>
      <span class="dim" style="font-size:10.5px" data-count></span>
    </div>
    <div class="rail-list"></div>
    <div class="rail-foot">
      <button class="btn" data-add>${icon('plus', 13)} Add slide</button>
      <button class="icon-btn" data-sorter title="Overview (G)">${icon('grid', 14)}</button>
    </div>`
  listEl = root.querySelector('.rail-list') as HTMLElement

  root.querySelector('[data-add]')?.addEventListener('click', (e) => {
    popover(e.currentTarget as HTMLElement, slideMenu())
  })
  root.querySelector('[data-sorter]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cadence:sorter'))
  })
}

export function slideMenu(): MenuItem[] {
  return SLIDE_TYPES.map((t) => ({
    label: t.label,
    icon: t.icon,
    onClick: () => {
      const at = store.slideIndex >= 0 ? store.slideIndex + 1 : undefined
      store.addSlide(newSlide(t.type), at)
    },
  }))
}

export function renderRail() {
  const deck = store.deck
  const count = rootEl.querySelector('[data-count]')
  if (count) count.textContent = `${deck.slides.length}`
  listEl.innerHTML = ''

  deck.slides.forEach((slide, i) => {
    const thumb = el<HTMLDivElement>(`<div class="thumb ${slide.id === store.ui.selectedId ? 'active' : ''}" draggable="true" data-id="${slide.id}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <div class="acts">
        <button data-dup title="Duplicate">${icon('copy', 11)}</button>
        <button data-del title="Delete">${icon('trash', 11)}</button>
      </div>
      <div class="surface" style="width:${THUMB_W}px;height:${(THUMB_W / 16) * 9}px"></div>
    </div>`)

    const surface = thumb.querySelector('.surface') as HTMLElement
    const node = renderSlide(slide, deck, i, deck.slides.length)
    node.style.transformOrigin = '0 0'
    node.style.transform = `scale(${THUMB_W / 1280})`
    node.style.pointerEvents = 'none'
    surface.appendChild(node)

    thumb.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-dup]')) return
      if (target.closest('[data-del]')) return
      store.select(slide.id)
      void 0
    })
    thumb.querySelector('[data-dup]')?.addEventListener('click', (e) => {
      e.stopPropagation()
      store.duplicateSlide(slide.id)
    })
    thumb.querySelector('[data-del]')?.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (deck.slides.length <= 1) return
      const ok = await confirmDialog('Delete slide?', `“${slide.title || prettyType(slide.type)}” will be removed. You can undo with ⌘Z.`)
      if (ok) store.removeSlide(slide.id)
    })

    thumb.addEventListener('dragstart', (e) => {
      thumb.classList.add('dragging')
      e.dataTransfer?.setData('text/plain', String(i))
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    })
    thumb.addEventListener('dragend', () => {
      thumb.classList.remove('dragging')
      clearDropMarks()
    })
    thumb.addEventListener('dragover', (e) => {
      e.preventDefault()
      const rect = thumb.getBoundingClientRect()
      const after = e.clientY > rect.top + rect.height / 2
      clearDropMarks()
      thumb.classList.add(after ? 'drop-after' : 'drop-before')
    })
    thumb.addEventListener('drop', (e) => {
      e.preventDefault()
      const from = Number(e.dataTransfer?.getData('text/plain') ?? -1)
      if (from < 0) return
      const rect = thumb.getBoundingClientRect()
      const after = e.clientY > rect.top + rect.height / 2
      let to = i + (after ? 1 : 0)
      if (to > from) to -= 0
      store.moveSlide(from, to)
      clearDropMarks()
    })

    listEl.appendChild(thumb)
  })
}

function clearDropMarks() {
  listEl.querySelectorAll('.thumb').forEach((t) => t.classList.remove('drop-before', 'drop-after'))
}

export function updateRailSelection() {
  listEl.querySelectorAll<HTMLElement>('.thumb').forEach((t) => {
    t.classList.toggle('active', t.dataset.id === store.ui.selectedId)
  })
  scrollSelectedIntoView()
}

export function scrollSelectedIntoView() {
  requestAnimationFrame(() => {
    listEl.querySelector('.thumb.active')?.scrollIntoView({ block: 'nearest' })
  })
}
