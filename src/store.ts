import type { Deck, Slide, UIState, DeckSettings } from './model/types'
import { defaultSettings } from './model/types'

export type ChangeKind = 'deck' | 'ui' | 'selection' | 'theme' | 'generate' | 'inline' | 'settings'
type Listener = (kind: ChangeKind) => void

const KEY = 'cadence.deck.v1'
const UI_KEY = 'cadence.ui.v1'

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)

const clone = <T>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))

function blankDeck(): Deck {
  return {
    id: uid(),
    title: 'Untitled deck',
    subtitle: '',
    theme: 'obsidian',
    archetype: 'pitch',
    slides: [],
    settings: defaultSettings(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/* ------------------------------------------------------------------ */

class Store {
  deck: Deck = blankDeck()
  ui: UIState = {
    selectedId: null,
    tab: 'content',
    railOpen: true,
    inspectorOpen: true,
    zoom: 'fit',
    presenting: false,
    presentingIndex: 0,
    generating: false,
    generatingLabel: '',
    paletteOpen: false,
    sorterOpen: false,
    focus: false,
  }

  private listeners = new Set<Listener>()
  private history: Deck[] = []
  private future: Deck[] = []
  private saveTimer: number | undefined

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(kind: ChangeKind = 'deck') {
    for (const fn of this.listeners) fn(kind)
    if (kind === 'deck' || kind === 'theme' || kind === 'inline' || kind === 'settings') this.persist()
  }

  /* ---------- history ---------- */

  snapshot() {
    this.history.push(clone(this.deck))
    if (this.history.length > 80) this.history.shift()
    this.future = []
  }

  undo() {
    const prev = this.history.pop()
    if (!prev) return
    this.future.push(clone(this.deck))
    this.deck = prev
    this.reconcileSelection()
    this.emit('deck')
  }

  redo() {
    const next = this.future.pop()
    if (!next) return
    this.history.push(clone(this.deck))
    this.deck = next
    this.reconcileSelection()
    this.emit('deck')
  }

  canUndo() {
    return this.history.length > 0
  }

  canRedo() {
    return this.future.length > 0
  }

  resetHistory() {
    this.history = []
    this.future = []
  }

  /* ---------- deck mutation ---------- */

  mutate(fn: (deck: Deck) => void, opts: { snapshot?: boolean; kind?: ChangeKind } = {}) {
    if (opts.snapshot !== false) this.snapshot()
    fn(this.deck)
    this.deck.updatedAt = Date.now()
    this.emit(opts.kind ?? 'deck')
  }

  setDeck(deck: Deck, opts: { snapshot?: boolean } = {}) {
    if (opts.snapshot !== false) this.snapshot()
    this.deck = deck
    this.ui.selectedId = deck.slides[0]?.id ?? null
    this.emit('deck')
  }

  /* ---------- slides ---------- */

  get slide(): Slide | undefined {
    return this.deck.slides.find((s) => s.id === this.ui.selectedId)
  }

  get slideIndex(): number {
    return this.deck.slides.findIndex((s) => s.id === this.ui.selectedId)
  }

  select(id: string | null, opts: { scroll?: boolean } = {}) {
    this.ui.selectedId = id
    this.emit('selection')
    if (opts.scroll !== false) {
      requestAnimationFrame(() => {
        document
          .querySelector(`.thumb[data-id="${id}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
    }
  }

  updateSlide(id: string, patch: Partial<Slide>, opts: { snapshot?: boolean } = {}) {
    this.mutate(
      (d) => {
        const s = d.slides.find((x) => x.id === id)
        if (s) Object.assign(s, patch)
      },
      { snapshot: opts.snapshot !== false }
    )
  }

  patchSettings(patch: Partial<DeckSettings>, kind: ChangeKind = 'settings') {
    this.mutate((d) => Object.assign(d.settings, patch), { kind })
  }

  addSlide(slide: Slide, at?: number) {
    this.mutate((d) => {
      const i = at ?? d.slides.length
      d.slides.splice(i, 0, slide)
    })
    this.select(slide.id)
  }

  duplicateSlide(id: string) {
    const i = this.deck.slides.findIndex((s) => s.id === id)
    if (i < 0) return
    const copy = clone(this.deck.slides[i])
    copy.id = uid()
    this.mutate((d) => d.slides.splice(i + 1, 0, copy))
    this.select(copy.id)
  }

  removeSlide(id: string) {
    const i = this.deck.slides.findIndex((s) => s.id === id)
    if (i < 0) return
    this.mutate((d) => d.slides.splice(i, 1))
    const next = this.deck.slides[Math.min(i, this.deck.slides.length - 1)]
    this.select(next?.id ?? null)
  }

  moveSlide(from: number, to: number) {
    if (from === to) return
    this.mutate((d) => {
      const [s] = d.slides.splice(from, 1)
      d.slides.splice(to > from ? to - 1 : to, 0, s)
    })
  }

  private reconcileSelection() {
    if (!this.deck.slides.some((s) => s.id === this.ui.selectedId)) {
      this.ui.selectedId = this.deck.slides[0]?.id ?? null
    }
  }

  /* ---------- persistence ---------- */

  persist() {
    window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => this.persistNow(), 350)
  }

  persistNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.deck))
      localStorage.setItem(UI_KEY, JSON.stringify({ tab: this.ui.tab }))
    } catch {
      /* quota — ignore */
    }
  }

  restore(): boolean {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return false
      const deck = JSON.parse(raw) as Deck
      if (!deck?.slides) return false
      this.deck = { ...blankDeck(), ...deck, settings: { ...defaultSettings(), ...deck.settings } }
      const ui = localStorage.getItem(UI_KEY)
      if (ui) {
        const parsed = JSON.parse(ui) as { tab?: UIState['tab'] }
        if (parsed.tab) this.ui.tab = parsed.tab
      }
      this.ui.selectedId = this.deck.slides[0]?.id ?? null
      return this.deck.slides.length > 0
    } catch {
      return false
    }
  }
}

export const store = new Store()

/* ---------- path helpers for inline editing ---------- */

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.')
  if (keys.length === 0) return
  let cur = obj as Record<string, unknown>
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] == null || typeof cur[k] !== 'object') {
      cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}
    }
    cur = cur[k] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
}
