export type SlideType =
  | 'title'
  | 'section'
  | 'statement'
  | 'bullets'
  | 'split'
  | 'stats'
  | 'stat'
  | 'quote'
  | 'timeline'
  | 'compare'
  | 'process'
  | 'chart'
  | 'table'
  | 'matrix'
  | 'image'
  | 'closing'

export interface Bullet {
  text: string
  detail?: string
}

export interface Stat {
  value: string
  label: string
  note?: string
}

export interface Column {
  title: string
  text?: string
  items?: string[]
  tone?: 'accent' | 'muted' | 'plain'
}

export interface Step {
  title: string
  when?: string
  text?: string
}

export interface ChartDatum {
  label: string
  value: number
}

export interface ChartSpec {
  kind: 'bar' | 'column' | 'line' | 'area' | 'donut'
  data: ChartDatum[]
  caption?: string
  prefix?: string
  suffix?: string
}

export interface TableSpec {
  head: string[]
  rows: string[][]
  caption?: string
}

export interface ImageSpec {
  src: string
  alt?: string
  caption?: string
  fit?: 'cover' | 'contain'
  shape?: 'square' | 'arch' | 'circle'
}

export interface MatrixPoint {
  label: string
  x: number
  y: number
  note?: string
}

export interface MatrixSpec {
  x: string
  y: string
  items: MatrixPoint[]
}

export interface Slide {
  id: string
  type: SlideType
  variant?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  bullets?: Bullet[]
  columns?: Column[]
  stats?: Stat[]
  quote?: { text: string; author?: string; role?: string }
  steps?: Step[]
  chart?: ChartSpec
  table?: TableSpec
  image?: ImageSpec
  matrix?: MatrixSpec
  notes?: string
  emphasis?: boolean
}

export interface DeckSettings {
  accent: string | null
  density: number
  scale: number
  radius: number
  showFooter: boolean
  showNumbers: boolean
  brand: string
}

export interface Deck {
  id: string
  title: string
  subtitle: string
  theme: string
  archetype: string
  slides: Slide[]
  settings: DeckSettings
  createdAt: number
  updatedAt: number
}

export interface AIProvider {
  id: 'vercel' | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom'
  label: string
  baseUrl: string
  model: string
  key: string
}

export interface AIConfig {
  provider: AIProvider['id']
  model: string
  key: string
  baseUrl: string
}

export type PanelTab = 'content' | 'layout' | 'design' | 'notes'

export interface UIState {
  selectedId: string | null
  tab: PanelTab
  railOpen: boolean
  inspectorOpen: boolean
  zoom: number | 'fit'
  presenting: boolean
  presentingIndex: number
  generating: boolean
  generatingLabel: string
  paletteOpen: boolean
  sorterOpen: boolean
  focus: boolean
}

export const defaultSettings = (): DeckSettings => ({
  accent: null,
  density: 1,
  scale: 1,
  radius: -1,
  showFooter: true,
  showNumbers: true,
  brand: '',
})
