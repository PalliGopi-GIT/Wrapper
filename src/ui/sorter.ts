import { store } from '../store'
import { renderSlide } from '../render/slide'
import { icon } from './icons'
import { el } from './dom'

let root: HTMLElement | null = null

export function openSorter() {
  if (root) return closeSorter()
  root = el<HTMLDivElement>(`<div class="sorter">
    <div class="sorter-head">
      <h2>Overview</h2>
      <span class="dim" style="font-size:11px" data-count></span>
      <div class="spacer"></div>
      <button class="btn ghost sm" data-close>${icon('x', 13)} Close</button>
    </div>
    <div class="sorter-body"></div>
  </div>`)
  document.body.appendChild(root)
  root.querySelector('[data-close]')?.addEventListener('click', closeSorter)
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSorter()
  })
  paint()
  window.addEventListener('keydown', onKey)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeSorter()
}

export function closeSorter() {
  window.removeEventListener('keydown', onKey)
  root?.remove()
  root = null
}

export function toggleSorter() {
  if (root) closeSorter()
  else openSorter()
}

function paint() {
  if (!root) return
  const body = root.querySelector('.sorter-body') as HTMLElement
  const count = root.querySelector('[data-count]')
  if (count) count.textContent = `${store.deck.slides.length} slides`
  body.innerHTML = ''
  const width = 248

  store.deck.slides.forEach((slide, i) => {
    const card = el<HTMLButtonElement>(`<button class="sorter-card" data-id="${slide.id}">
      <div class="frame" style="width:${width}px;height:${(width / 16) * 9}px">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
      </div>
      <div class="cap">${escape(slide.title || slide.type)}</div>
    </button>`)
    const frame = card.querySelector('.frame') as HTMLElement
    const node = renderSlide(slide, store.deck, i, store.deck.slides.length)
    node.style.transformOrigin = '0 0'
    node.style.transform = `scale(${width / 1280})`
    node.style.pointerEvents = 'none'
    frame.appendChild(node)
    card.addEventListener('click', () => {
      store.select(slide.id)
      closeSorter()
    })
    body.appendChild(card)
  })

  const add = el<HTMLButtonElement>(`<button class="sorter-card" data-add>
    <div class="frame" style="width:${width}px;height:${(width / 16) * 9}px;display:grid;place-items:center;border-style:dashed;color:var(--ui-faint)">
      ${icon('plus', 22)}
    </div>
    <div class="cap">Add slide</div>
  </button>`)
  add.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cadence:add'))
  })
  body.appendChild(add)
}

function escape(s: string) {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
}
