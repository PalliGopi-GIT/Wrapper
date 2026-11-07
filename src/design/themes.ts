import type { DeckSettings } from '../model/types.js'

export type Deco =
  | 'none'
  | 'grain'
  | 'grid'
  | 'mesh'
  | 'frame'
  | 'rules'
  | 'blocks'
  | 'dots'
  | 'blueprint'
  | 'aura'

export interface Theme {
  id: string
  name: string
  blurb: string
  mode: 'light' | 'dark'
  swatch: string[]
  deco: Deco
  color: {
    bg: string
    surface: string
    ink: string
    inkSoft: string
    muted: string
    line: string
    accent: string
    accentInk: string
    accentSoft: string
    chart: string[]
  }
  type: {
    display: string
    body: string
    mono: string
    heroSize: number
    titleSize: number
    leadSize: number
    bodySize: number
    smallSize: number
    microSize: number
    displayWeight: number
    bodyWeight: number
    tracking: number
    case: 'none' | 'upper'
    lineHeight: number
  }
  shape: { radius: number; rule: number; pad: number }
  pptx: { font: string; display: string }
}

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
const SERIF = "'Instrument Serif', 'Times New Roman', Georgia, serif"

export const THEMES: Theme[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    blurb: 'Executive minimal. Serif headlines, hairline rules, champagne accent.',
    mode: 'dark',
    swatch: ['#0B0B0C', '#D3B673', '#F2F0EC'],
    deco: 'grain',
    color: {
      bg: '#0B0B0C',
      surface: '#141416',
      ink: '#F2F0EC',
      inkSoft: '#CFCAC1',
      muted: '#8C877F',
      line: 'rgba(242,240,236,0.13)',
      accent: '#D3B673',
      accentInk: '#0B0B0C',
      accentSoft: 'rgba(211,182,115,0.13)',
      chart: ['#D3B673', '#8E8779', '#5E5A53', '#C7C2B8', '#3A3833'],
    },
    type: {
      display: SERIF,
      body: SANS,
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 104,
      titleSize: 44,
      leadSize: 26,
      bodySize: 17,
      smallSize: 13,
      microSize: 11,
      displayWeight: 400,
      bodyWeight: 400,
      tracking: -0.02,
      case: 'none',
      lineHeight: 1.12,
    },
    shape: { radius: 3, rule: 1, pad: 88 },
    pptx: { font: 'Arial', display: 'Georgia' },
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    blurb: 'White gallery space. Tight sans, cobalt accent, nothing extra.',
    mode: 'light',
    swatch: ['#FBFBF9', '#1B36D6', '#101010'],
    deco: 'none',
    color: {
      bg: '#FBFBF9',
      surface: '#FFFFFF',
      ink: '#101010',
      inkSoft: '#3A3A3A',
      muted: '#8A8A85',
      line: '#E4E4DE',
      accent: '#1B36D6',
      accentInk: '#FFFFFF',
      accentSoft: 'rgba(27,54,214,0.07)',
      chart: ['#1B36D6', '#101010', '#9C9C96', '#7B8AF0', '#D9D9D2'],
    },
    type: {
      display: SANS,
      body: SANS,
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 92,
      titleSize: 40,
      leadSize: 24,
      bodySize: 17,
      smallSize: 13,
      microSize: 11,
      displayWeight: 500,
      bodyWeight: 400,
      tracking: -0.03,
      case: 'none',
      lineHeight: 1.1,
    },
    shape: { radius: 0, rule: 1, pad: 96 },
    pptx: { font: 'Arial', display: 'Arial' },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Deep indigo mesh, glass panels, violet-to-mint light.',
    mode: 'dark',
    swatch: ['#080B17', '#8B7CFF', '#4CE0D2'],
    deco: 'mesh',
    color: {
      bg: '#080B17',
      surface: 'rgba(255,255,255,0.055)',
      ink: '#EFF2FF',
      inkSoft: '#BCC4E2',
      muted: '#7D88AB',
      line: 'rgba(255,255,255,0.12)',
      accent: '#8B7CFF',
      accentInk: '#0A0D1A',
      accentSoft: 'rgba(139,124,255,0.16)',
      chart: ['#8B7CFF', '#4CE0D2', '#FF8FB1', '#FFC46B', '#5B6488'],
    },
    type: {
      display: "'Sora', 'Inter', sans-serif",
      body: SANS,
      mono: "'JetBrains Mono', ui-monospace, monospace",
      heroSize: 96,
      titleSize: 42,
      leadSize: 25,
      bodySize: 17,
      smallSize: 13,
      microSize: 11,
      displayWeight: 600,
      bodyWeight: 400,
      tracking: -0.028,
      case: 'none',
      lineHeight: 1.13,
    },
    shape: { radius: 14, rule: 1, pad: 84 },
    pptx: { font: 'Arial', display: 'Arial' },
  },
  {
    id: 'broadside',
    name: 'Broadside',
    blurb: 'Magazine editorial. Playfair, cream stock, true red.',
    mode: 'light',
    swatch: ['#F3EFE6', '#B3392F', '#16130F'],
    deco: 'rules',
    color: {
      bg: '#F3EFE6',
      surface: '#FBF8F1',
      ink: '#16130F',
      inkSoft: '#3B342B',
      muted: '#8A7F6E',
      line: '#D6CBB7',
      accent: '#B3392F',
      accentInk: '#FFF8F0',
      accentSoft: 'rgba(179,57,47,0.08)',
      chart: ['#B3392F', '#3B342B', '#A0907A', '#D6CBB7', '#6B5F4E'],
    },
    type: {
      display: "'Playfair Display', Georgia, serif",
      body: "'Libre Baskerville', Georgia, serif",
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 92,
      titleSize: 46,
      leadSize: 24,
      bodySize: 16,
      smallSize: 12,
      microSize: 10.5,
      displayWeight: 400,
      bodyWeight: 400,
      tracking: -0.015,
      case: 'none',
      lineHeight: 1.18,
    },
    shape: { radius: 0, rule: 2, pad: 84 },
    pptx: { font: 'Georgia', display: 'Georgia' },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    blurb: 'Phosphor console. Monospace, uppercase, technical grids.',
    mode: 'dark',
    swatch: ['#07090A', '#6EF3A5', '#D7E2DA'],
    deco: 'grid',
    color: {
      bg: '#07090A',
      surface: '#0E1214',
      ink: '#D7E2DA',
      inkSoft: '#93A79A',
      muted: '#5E7268',
      line: 'rgba(110,243,165,0.18)',
      accent: '#6EF3A5',
      accentInk: '#04120A',
      accentSoft: 'rgba(110,243,165,0.10)',
      chart: ['#6EF3A5', '#3E8F6B', '#9FE8C6', '#2C5A45', '#D7E2DA'],
    },
    type: {
      display: "'JetBrains Mono', ui-monospace, monospace",
      body: "'JetBrains Mono', ui-monospace, monospace",
      mono: "'JetBrains Mono', ui-monospace, monospace",
      heroSize: 74,
      titleSize: 34,
      leadSize: 21,
      bodySize: 15,
      smallSize: 12,
      microSize: 10.5,
      displayWeight: 500,
      bodyWeight: 300,
      tracking: -0.01,
      case: 'upper',
      lineHeight: 1.2,
    },
    shape: { radius: 0, rule: 1, pad: 80 },
    pptx: { font: 'Consolas', display: 'Consolas' },
  },
  {
    id: 'swiss',
    name: 'Swiss',
    blurb: 'International style. Grudging whitespace, brutal grid, one red.',
    mode: 'light',
    swatch: ['#FFFFFF', '#EF3A2B', '#0A0A0A'],
    deco: 'dots',
    color: {
      bg: '#FFFFFF',
      surface: '#F4F4F2',
      ink: '#0A0A0A',
      inkSoft: '#2E2E2E',
      muted: '#8C8C88',
      line: '#DCDCD8',
      accent: '#EF3A2B',
      accentInk: '#FFFFFF',
      accentSoft: 'rgba(239,58,43,0.08)',
      chart: ['#0A0A0A', '#EF3A2B', '#B4B4B0', '#6E6E6A', '#E2E2DE'],
    },
    type: {
      display: SANS,
      body: SANS,
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 86,
      titleSize: 38,
      leadSize: 22,
      bodySize: 16,
      smallSize: 12.5,
      microSize: 10.5,
      displayWeight: 700,
      bodyWeight: 400,
      tracking: -0.04,
      case: 'none',
      lineHeight: 1.06,
    },
    shape: { radius: 0, rule: 1, pad: 78 },
    pptx: { font: 'Arial', display: 'Arial' },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    blurb: 'Warm paper, clay and sage, humanist serif with room to breathe.',
    mode: 'light',
    swatch: ['#F7F1E8', '#B4552D', '#2A211B'],
    deco: 'aura',
    color: {
      bg: '#F7F1E8',
      surface: '#FFFBF4',
      ink: '#2A211B',
      inkSoft: '#57483C',
      muted: '#94826F',
      line: '#E3D6C4',
      accent: '#B4552D',
      accentInk: '#FFF8F0',
      accentSoft: 'rgba(180,85,45,0.09)',
      chart: ['#B4552D', '#6C7F5D', '#C9A98C', '#E3D6C4', '#8A6A52'],
    },
    type: {
      display: "'Fraunces', Georgia, serif",
      body: "'DM Sans', 'Inter', sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 90,
      titleSize: 44,
      leadSize: 25,
      bodySize: 17,
      smallSize: 13,
      microSize: 11,
      displayWeight: 400,
      bodyWeight: 400,
      tracking: -0.02,
      case: 'none',
      lineHeight: 1.16,
    },
    shape: { radius: 10, rule: 1, pad: 88 },
    pptx: { font: 'Georgia', display: 'Georgia' },
  },
  {
    id: 'meridian',
    name: 'Meridian',
    blurb: 'Black tie. Gold hairlines, wide air, couture serif.',
    mode: 'dark',
    swatch: ['#08090A', '#C9A227', '#F4F1E9'],
    deco: 'frame',
    color: {
      bg: '#08090A',
      surface: '#101214',
      ink: '#F4F1E9',
      inkSoft: '#CFC7B4',
      muted: '#877F6E',
      line: 'rgba(201,162,39,0.24)',
      accent: '#C9A227',
      accentInk: '#08090A',
      accentSoft: 'rgba(201,162,39,0.10)',
      chart: ['#C9A227', '#7A6A3E', '#EFE8D6', '#4A4433', '#8C8578'],
    },
    type: {
      display: "'Playfair Display', Georgia, serif",
      body: SANS,
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 96,
      titleSize: 42,
      leadSize: 24,
      bodySize: 16,
      smallSize: 12.5,
      microSize: 10.5,
      displayWeight: 400,
      bodyWeight: 400,
      tracking: 0.01,
      case: 'upper',
      lineHeight: 1.14,
    },
    shape: { radius: 0, rule: 1, pad: 92 },
    pptx: { font: 'Arial', display: 'Georgia' },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    blurb: 'Engineering drawing. Navy field, cyan rules, annotation ticks.',
    mode: 'dark',
    swatch: ['#0A1626', '#4FC3F7', '#E6F0FA'],
    deco: 'blueprint',
    color: {
      bg: '#0A1626',
      surface: '#0F1F33',
      ink: '#E6F0FA',
      inkSoft: '#A9C2D8',
      muted: '#6C8AA5',
      line: 'rgba(120,200,255,0.17)',
      accent: '#4FC3F7',
      accentInk: '#04121E',
      accentSoft: 'rgba(79,195,247,0.12)',
      chart: ['#4FC3F7', '#FFB74D', '#7E9FBC', '#2E5B7E', '#D6E6F2'],
    },
    type: {
      display: "'IBM Plex Sans', 'Inter', sans-serif",
      body: "'IBM Plex Sans', 'Inter', sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, monospace",
      heroSize: 84,
      titleSize: 38,
      leadSize: 22,
      bodySize: 15.5,
      smallSize: 12,
      microSize: 10.5,
      displayWeight: 300,
      bodyWeight: 400,
      tracking: -0.015,
      case: 'upper',
      lineHeight: 1.16,
    },
    shape: { radius: 0, rule: 1, pad: 80 },
    pptx: { font: 'Arial', display: 'Arial' },
  },
  {
    id: 'kinetic',
    name: 'Kinetic',
    blurb: 'Poster energy. Archivo Black, acid lime, oversized numerals.',
    mode: 'light',
    swatch: ['#F2F1EC', '#D6FF3F', '#0A0A0A'],
    deco: 'blocks',
    color: {
      bg: '#F2F1EC',
      surface: '#FFFFFF',
      ink: '#0A0A0A',
      inkSoft: '#2A2A2A',
      muted: '#7E7E78',
      line: '#0A0A0A',
      accent: '#D6FF3F',
      accentInk: '#0A0A0A',
      accentSoft: 'rgba(214,255,63,0.35)',
      chart: ['#0A0A0A', '#D6FF3F', '#8F8F88', '#C9C9C0', '#4A4A45'],
    },
    type: {
      display: "'Archivo Black', 'Archivo', sans-serif",
      body: "'Archivo', 'Inter', sans-serif",
      mono: "'JetBrains Mono', ui-monospace, monospace",
      heroSize: 108,
      titleSize: 48,
      leadSize: 26,
      bodySize: 17,
      smallSize: 13,
      microSize: 11,
      displayWeight: 400,
      bodyWeight: 500,
      tracking: -0.035,
      case: 'upper',
      lineHeight: 0.98,
    },
    shape: { radius: 0, rule: 2, pad: 76 },
    pptx: { font: 'Arial Black', display: 'Arial Black' },
  },
]

export const getTheme = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0]

const px = (n: number) => `${Math.round(n * 100) / 100}px`
const fs = (n: number) => `calc(${Math.round(n * 100) / 100}px * var(--fit, 1))`

export function themeVars(t: Theme, s: DeckSettings): Record<string, string> {
  const accent = s.accent || t.color.accent
  const accentSoft = s.accent
    ? `color-mix(in srgb, ${s.accent} 14%, transparent)`
    : t.color.accentSoft
  const accentInk = s.accent ? readableOn(s.accent) : t.color.accentInk
  const scale = s.scale
  const d = s.density
  const pad = t.shape.pad * d * (0.94 + 0.06 * scale)
  const radius = s.radius >= 0 ? s.radius : t.shape.radius

  return {
    '--bg': t.color.bg,
    '--surface': t.color.surface,
    '--ink': t.color.ink,
    '--ink-soft': t.color.inkSoft,
    '--muted': t.color.muted,
    '--line': t.color.line,
    '--accent': accent,
    '--accent-ink': accentInk,
    '--accent-soft': accentSoft,
    '--font-display': t.type.display,
    '--font-body': t.type.body,
    '--font-mono': t.type.mono,
    '--fs-hero': fs(t.type.heroSize * scale),
    '--fs-title': fs(t.type.titleSize * scale),
    '--fs-lead': fs(t.type.leadSize * scale),
    '--fs-body': fs(t.type.bodySize * scale),
    '--fs-small': fs(t.type.smallSize * scale),
    '--fs-micro': fs(t.type.microSize * scale),
    '--fw-display': String(t.type.displayWeight),
    '--fw-body': String(t.type.bodyWeight),
    '--tracking': `${t.type.tracking}em`,
    '--lh': String(t.type.lineHeight),
    '--text-case': t.type.case === 'upper' ? 'uppercase' : 'none',
    '--radius': px(radius),
    '--rule': px(t.shape.rule),
    '--pad': px(pad),
    '--gap': px(26 * d * scale),
    '--gap-lg': px(44 * d * scale),
    '--c1': t.color.chart[0],
    '--c2': t.color.chart[1] ?? t.color.accent,
    '--c3': t.color.chart[2] ?? t.color.muted,
    '--c4': t.color.chart[3] ?? t.color.muted,
  }
}

export function readableOn(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#FFFFFF'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.55 ? '#0A0A0A' : '#FFFFFF'
}
