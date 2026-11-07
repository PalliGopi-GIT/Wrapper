import type { AIConfig, Deck, Slide, SlideType } from '../model/types.js'
import { defaultSettings } from '../model/types.js'
import { uid } from '../store.js'
import { callModel, extractJSON } from './client.js'
import {
  BASE_SYSTEM,
  DECK_OP_SYSTEM,
  OUTLINE_SYSTEM,
  SLIDE_REWRITE_SYSTEM,
  buildAddSlidePrompt,
  buildDeckOpPrompt,
  buildDeckPrompt,
  buildOutlinePrompt,
  buildSlideRewritePrompt,
  type GenRequest,
} from './prompts.js'

const TYPES: SlideType[] = [
  'title',
  'section',
  'statement',
  'bullets',
  'split',
  'stats',
  'stat',
  'quote',
  'timeline',
  'compare',
  'process',
  'chart',
  'table',
  'matrix',
  'image',
  'closing',
]

const ALIASES: Record<string, SlideType> = {
  title_slide: 'title',
  cover: 'title',
  agenda: 'bullets',
  content: 'bullets',
  bullet: 'bullets',
  bullets_slide: 'bullets',
  key_points: 'bullets',
  metrics: 'stats',
  metric: 'stats',
  kpi: 'stats',
  big_stat: 'stat',
  number: 'stat',
  big_number: 'stat',
  testimonial: 'quote',
  road: 'timeline',
  roadmap: 'timeline',
  versus: 'compare',
  comparison: 'compare',
  steps: 'process',
  graph: 'chart',
  data: 'chart',
  grid: 'table',
  quadrant: 'matrix',
  positioning: 'matrix',
  photo: 'image',
  full_image: 'image',
  thanks: 'closing',
  end: 'closing',
  summary: 'bullets',
}

const str = (v: unknown, max = 400): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function inferType(r: Record<string, unknown>): SlideType {
  if (r.chart) return 'chart'
  if (r.table) return 'table'
  if (r.matrix) return 'matrix'
  if (r.quote) return 'quote'
  if (arr(r.steps).length) return arr(r.steps).length > 0 && r.when ? 'timeline' : 'process'
  if (arr(r.columns).length) return 'compare'
  if (arr(r.stats).length > 1) return 'stats'
  if (arr(r.stats).length === 1) return 'stat'
  if (r.image) return 'image'
  if (arr(r.bullets).length) return 'bullets'
  if (r.subtitle && !r.body) return 'statement'
  return 'bullets'
}

export function coerceSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  let type = str(r.type, 30).toLowerCase().replace(/[\s-]+/g, '_')
  type = (ALIASES[type] ?? type) as string
  let resolved = (TYPES.includes(type as SlideType) ? type : inferType(r)) as SlideType

  const notes = str(r.notes ?? r.speaker_notes ?? r.speakerNotes, 1200)
  const slide: Slide = { id: uid(), type: resolved, notes }
  if (r.eyebrow) slide.eyebrow = str(r.eyebrow, 80)
  if (r.title) slide.title = str(r.title, 220)
  if (r.subtitle) slide.subtitle = str(r.subtitle, 320)
  if (r.body) slide.body = str(r.body, 700)
  if (r.variant && typeof r.variant === 'string') slide.variant = r.variant

  if (arr(r.bullets).length) {
    slide.bullets = arr(r.bullets)
      .slice(0, 6)
      .map((b) => {
        if (typeof b === 'string') return { text: str(b, 160) }
        const o = b as Record<string, unknown>
        return { text: str(o.text ?? o.title, 160), detail: str(o.detail ?? o.description, 240) || undefined }
      })
      .filter((b) => b.text)
  }

  if (arr(r.stats).length) {
    slide.stats = arr(r.stats)
      .slice(0, 4)
      .map((s) => {
        const o = s as Record<string, unknown>
        return {
          value: str(o.value, 24),
          label: str(o.label ?? o.description, 120),
          note: str(o.note, 80) || undefined,
        }
      })
      .filter((s) => s.value || s.label)
  }

  if (r.quote && typeof r.quote === 'object') {
    const q = r.quote as Record<string, unknown>
    const text = str(q.text, 400)
    if (text) slide.quote = { text, author: str(q.author, 80), role: str(q.role, 100) }
  }

  if (arr(r.steps).length) {
    slide.steps = arr(r.steps)
      .slice(0, 6)
      .map((s) => {
        const o = s as Record<string, unknown>
        return {
          title: str(o.title ?? o.label, 120),
          when: str(o.when ?? o.date ?? o.phase, 40) || undefined,
          text: str(o.text ?? o.description, 200) || undefined,
        }
      })
      .filter((s) => s.title)
  }

  if (arr(r.columns).length) {
    slide.columns = arr(r.columns)
      .slice(0, 2)
      .map((c, i) => {
        const o = c as Record<string, unknown>
        const tone = o.tone === 'accent' || o.tone === 'muted' ? o.tone : i === 1 ? 'accent' : 'muted'
        return {
          title: str(o.title, 80),
          items: arr(o.items).map((x) => str(x, 160)).filter(Boolean),
          tone,
        } as NonNullable<Slide['columns']>[number]
      })
  }

  if (r.chart && typeof r.chart === 'object') {
    const c = r.chart as Record<string, unknown>
    const data = arr(c.data)
      .map((d) => {
        const o = d as Record<string, unknown>
        const value = typeof o.value === 'string' ? parseFloat(o.value) : Number(o.value)
        return { label: str(o.label, 40), value: Number.isFinite(value) ? value : 0 }
      })
      .filter((d) => d.label)
    if (data.length) {
      const kind = ['area', 'line', 'column', 'bar', 'donut'].includes(String(c.kind))
        ? (c.kind as 'area' | 'line' | 'column' | 'bar' | 'donut')
        : 'column'
      slide.chart = { kind, data, caption: str(c.caption, 120), suffix: str(c.suffix, 8), prefix: str(c.prefix, 8) }
    }
  }

  if (r.table && typeof r.table === 'object') {
    const t = r.table as Record<string, unknown>
    const head = arr(t.head).map((h) => str(h, 60)).filter(Boolean)
    const rows = arr(t.rows)
      .map((row) => arr(row).map((cell) => str(cell, 120)))
      .filter((row) => row.length)
    if (head.length && rows.length) slide.table = { head, rows, caption: str(t.caption, 120) || undefined }
  }

  if (r.matrix && typeof r.matrix === 'object') {
    const m = r.matrix as Record<string, unknown>
    const items = arr(m.items)
      .map((it) => {
        const o = it as Record<string, unknown>
        const x = Number(o.x)
        const y = Number(o.y)
        return { label: str(o.label, 40), x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 }
      })
      .filter((it) => it.label)
    if (items.length) slide.matrix = { x: str(m.x, 40) || 'X axis', y: str(m.y, 40) || 'Y axis', items }
  }

  if (r.image && typeof r.image === 'object') {
    const im = r.image as Record<string, unknown>
    const src = str(im.src ?? im.url, 600)
    if (src) slide.image = { src, alt: str(im.alt, 160), caption: str(im.caption, 160) }
  }

  if (!slide.title && !slide.quote && !slide.stats?.length && !slide.chart && !slide.table) return null

  // sanity: collapse types that lost their payload
  if (resolved === 'chart' && !slide.chart) resolved = slide.bullets?.length ? 'bullets' : 'statement'
  if (resolved === 'table' && !slide.table) resolved = 'bullets'
  if (resolved === 'compare' && !slide.columns?.length) resolved = 'bullets'
  if (resolved === 'image' && !slide.image) resolved = 'statement'
  if ((resolved === 'process' || resolved === 'timeline') && !slide.steps?.length) resolved = 'bullets'
  if ((resolved === 'stats' || resolved === 'stat') && !slide.stats?.length) resolved = 'statement'
  if (resolved === 'quote' && !slide.quote) resolved = 'statement'
  slide.type = resolved

  if (!slide.title) slide.title = slide.quote?.text?.slice(0, 80) ?? img(slide.type)
  return slide
}

function img(type: SlideType): string {
  return type === 'closing' ? 'Thank you' : 'Untitled slide'
}

/* ------------------------------------------------------------------ */

export interface GenerateResult {
  title: string
  subtitle: string
  slides: Slide[]
}

export async function generateDeck(cfg: AIConfig, req: GenRequest): Promise<GenerateResult> {
  const raw = await callModel(cfg, {
    system: BASE_SYSTEM,
    user: buildDeckPrompt(req),
    json: true,
    temperature: 0.75,
    maxTokens: 9000,
  })
  const parsed = extractJSON<Record<string, unknown>>(raw)
  const slidesRaw = Array.isArray(parsed.slides) ? parsed.slides : Array.isArray(parsed) ? parsed : []
  const slides = slidesRaw.map(coerceSlide).filter((s): s is Slide => !!s)
  if (slides.length < 2) throw new Error('The model returned too few usable slides. Try again or switch models.')
  return {
    title: str(parsed.title, 90) || req.topic.slice(0, 60),
    subtitle: str(parsed.subtitle, 160),
    slides,
  }
}

export async function outlineDeck(cfg: AIConfig, req: GenRequest): Promise<string[]> {
  const raw = await callModel(cfg, {
    system: OUTLINE_SYSTEM,
    user: buildOutlinePrompt(req),
    json: true,
    temperature: 0.8,
    maxTokens: 1500,
  })
  const parsed = extractJSON<{ spine?: unknown[] }>(raw)
  return arr(parsed.spine).map((s) => str(s, 120)).filter(Boolean)
}

export async function reviseSlide(
  cfg: AIConfig,
  args: { slide: Slide; instruction: string; deckTitle: string; position: string; theme: string }
): Promise<Slide> {
  const raw = await callModel(cfg, {
    system: SLIDE_REWRITE_SYSTEM,
    user: buildSlideRewritePrompt({
      slide: stripId(args.slide),
      instruction: args.instruction,
      deckTitle: args.deckTitle,
      position: args.position,
      theme: args.theme,
    }),
    json: true,
    temperature: 0.7,
    maxTokens: 1600,
  })
  const parsed = extractJSON<unknown>(raw)
  const slide = coerceSlide(Array.isArray(parsed) ? parsed[0] : parsed)
  if (!slide) throw new Error('The model did not return a usable slide.')
  slide.id = args.slide.id
  return slide
}

export async function addSlide(
  cfg: AIConfig,
  deck: Deck,
  instruction: string
): Promise<Slide> {
  const raw = await callModel(cfg, {
    system: SLIDE_REWRITE_SYSTEM,
    user: buildAddSlidePrompt(deck, instruction, deck.theme),
    json: true,
    temperature: 0.75,
    maxTokens: 1600,
  })
  const parsed = extractJSON<unknown>(raw)
  const slide = coerceSlide(Array.isArray(parsed) ? parsed[0] : parsed)
  if (!slide) throw new Error('The model did not return a usable slide.')
  return slide
}

export async function editDeck(
  cfg: AIConfig,
  deck: Deck,
  instruction: string
): Promise<{ title: string; subtitle: string; slides: Slide[] }> {
  const raw = await callModel(cfg, {
    system: DECK_OP_SYSTEM,
    user: buildDeckOpPrompt(
      { title: deck.title, subtitle: deck.subtitle, slides: deck.slides.map(stripId) },
      instruction
    ),
    json: true,
    temperature: 0.65,
    maxTokens: 12000,
  })
  const parsed = extractJSON<Record<string, unknown>>(raw)
  const slidesRaw = arr(parsed.slides)
  const slides = slidesRaw
    .map((s, i) => {
      const slide = coerceSlide(s)
      if (slide) slide.id = deck.slides[i]?.id ?? slide.id
      return slide
    })
    .filter((s): s is Slide => !!s)
  if (!slides.length) throw new Error('The edit returned no slides.')
  return {
    title: str(parsed.title, 90) || deck.title,
    subtitle: str(parsed.subtitle, 160) || deck.subtitle,
    slides,
  }
}

function stripId(s: Slide): Omit<Slide, 'id'> {
  const { id: _id, ...rest } = s
  return rest
}

export function deckFromResult(
  result: GenerateResult,
  opts: { theme: string; archetype: string; brand: string }
): Deck {
  return {
    id: uid(),
    title: result.title,
    subtitle: result.subtitle,
    theme: opts.theme,
    archetype: opts.archetype,
    slides: result.slides,
    settings: { ...defaultSettings(), brand: opts.brand },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
