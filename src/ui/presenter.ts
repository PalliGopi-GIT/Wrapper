import { store } from '../store'
import { renderSlide, autofit } from '../render/slide'
import { icon } from './icons'
import { el } from './dom'

let root: HTMLElement | null = null
let index = 0
let notesOn = false
let startTime = 0
let timerId: number | undefined

export function openPresenter(from = store.slideIndex) {
  if (root) return
  index = Math.max(0, from)
  startTime = Date.now()

  root = el<HTMLDivElement>(`<div class="present">
    <div class="stage"></div>
    <div class="notes hide"><div class="t">Speaker notes</div><div class="nt"></div></div>
    <div class="hud">
      <div class="prog" style="width:0"></div>
      <span class="timer">00:00</span>
      <span class="dim" data-pos></span>
      <div class="dots"></div>
      <div class="spacer"></div>
      <button class="icon-btn" data-notes title="Notes (N)">${icon('note', 14)}</button>
      <button class="icon-btn" data-full title="Fullscreen (F)">${icon('fullscreen', 14)}</button>
      <button class="icon-btn" data-exit title="Exit (Esc)">${icon('x', 14)}</button>
    </div>
  </div>`)
  document.body.appendChild(root)

  root.querySelector('[data-exit]')?.addEventListener('click', exit)
  root.querySelector('[data-notes]')?.addEventListener('click', toggleNotes)
  root.querySelector('[data-full]')?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  })

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('.hud') || target.closest('.notes')) return
    const x = e.clientX / window.innerWidth
    if (x > 0.6) go(1)
    else if (x < 0.4) go(-1)
  })

  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', fit)
  timerId = window.setInterval(tick, 1000)
  paint()
  const hud = root.querySelector('.hud') as HTMLElement | null
  hud?.classList.add('show')
  window.setTimeout(() => hud?.classList.remove('show'), 2800)
  void document.documentElement.requestFullscreen?.().catch(() => undefined)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (document.fullscreenElement) void document.exitFullscreen()
    else exit()
  }
  if (['ArrowRight', ' ', 'PageDown', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    go(1)
  }
  if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    go(-1)
  }
  if (e.key === 'n' || e.key === 'N') toggleNotes()
  if (e.key === 'Home') {
    index = 0
    paint()
  }
  if (e.key === 'End') {
    index = store.deck.slides.length - 1
    paint()
  }
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }
}

function go(dir: number) {
  const next = Math.max(0, Math.min(store.deck.slides.length - 1, index + dir))
  if (next === index) return
  index = next
  paint()
}

function toggleNotes() {
  notesOn = !notesOn
  root?.querySelector('.notes')?.classList.toggle('hide', !notesOn)
  root?.querySelector('.notes')?.classList.toggle('on', notesOn)
  const n = root?.querySelector('[data-notes]') as HTMLElement | null
  n?.classList.toggle('on', notesOn)
}

function tick() {
  if (!root) return
  const s = Math.floor((Date.now() - startTime) / 1000)
  const t = root.querySelector('.timer')
  if (t) t.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function paint() {
  if (!root) return
  const deck = store.deck
  const slide = deck.slides[index]
  const stage = root.querySelector('.stage') as HTMLElement
  stage.innerHTML = ''
  if (!slide) return

  const node = renderSlide(slide, deck, index, deck.slides.length)
  node.style.transformOrigin = '0 0'
  const host = el<HTMLDivElement>(`<div class="slide-host"></div>`)
  host.appendChild(node)
  stage.appendChild(host)
  autofit(node)
  ;(root as HTMLElement & { _host?: HTMLElement })._host = host

  const pos = root.querySelector('[data-pos]')
  if (pos) pos.textContent = `${index + 1} / ${deck.slides.length}`
  const dots = root.querySelector('.dots')
  if (dots) {
    dots.innerHTML = deck.slides
      .map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`)
      .join('')
  }
  const prog = root.querySelector('.prog') as HTMLElement
  if (prog) prog.style.width = `${((index + 1) / deck.slides.length) * 100}%`

  const notes = root.querySelector('.nt')
  if (notes) notes.textContent = slide.notes || 'No notes for this slide.'

  store.ui.presenting = true
  store.ui.presentingIndex = index
  fit()
  tick()
}

function fit() {
  if (!root) return
  const host = (root as HTMLElement & { _host?: HTMLElement })._host
  if (!host) return
  const stage = root.querySelector('.stage') as HTMLElement
  const pad = 36
  const k = Math.min((stage.clientWidth - pad) / 1280, (stage.clientHeight - pad) / 720)
  host.style.width = `${1280 * k}px`
  host.style.height = `${720 * k}px`
  const s = host.firstElementChild as HTMLElement
  if (s) s.style.transform = `scale(${k})`
}

export function exit() {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', fit)
  window.clearInterval(timerId)
  root?.remove()
  root = null
  store.ui.presenting = false
  store.emit('ui')
}

export function isPresenting() {
  return !!root
}
