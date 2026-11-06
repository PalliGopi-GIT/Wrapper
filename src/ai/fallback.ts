import type { Slide, SlideType } from '../model/types'
import { uid } from '../store'
import type { GenRequest } from './prompts'
import type { GenerateResult } from './generate'

/**
 * A deterministic composer used when no model is configured.
 * It follows the same narrative arcs as the prompt library and leaves
 * bracketed placeholders where a fact must come from the user.
 */

const ARCS: Record<string, SlideType[]> = {
  pitch: ['title', 'statement', 'stat', 'bullets', 'split', 'process', 'chart', 'compare', 'table', 'stats', 'closing'],
  launch: ['title', 'statement', 'bullets', 'section', 'split', 'process', 'stats', 'compare', 'quote', 'timeline', 'closing'],
  sales: ['title', 'statement', 'bullets', 'split', 'process', 'chart', 'table', 'compare', 'quote', 'timeline', 'closing'],
  qbr: ['title', 'statement', 'stats', 'chart', 'table', 'bullets', 'compare', 'process', 'timeline', 'closing'],
  strategy: ['title', 'statement', 'bullets', 'matrix', 'compare', 'process', 'chart', 'table', 'timeline', 'closing'],
  research: ['title', 'statement', 'bullets', 'section', 'process', 'chart', 'table', 'quote', 'statement', 'closing'],
  workshop: ['title', 'statement', 'bullets', 'section', 'process', 'split', 'compare', 'table', 'closing'],
  keynote: ['title', 'statement', 'bullets', 'statement', 'section', 'split', 'chart', 'quote', 'matrix', 'statement', 'closing'],
  case: ['title', 'statement', 'bullets', 'process', 'chart', 'stats', 'quote', 'table', 'statement', 'closing'],
  allhands: ['title', 'statement', 'stats', 'chart', 'bullets', 'process', 'compare', 'timeline', 'closing'],
}

const clean = (s: string) => s.trim().replace(/[.!?,;:]+$/, '')
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const short = (s: string, n = 7) => s.split(/\s+/).slice(0, n).join(' ')

/** Best-effort short subject: the thing the deck is about. */
function subjectOf(topic: string): string {
  const t = clean(topic)
  const afterFor = t.match(/\b(?:for|about|on|covering|introducing)\s+(.+)$/i)
  if (afterFor) {
    const s = afterFor[1].split(/[,.(]/)[0].trim()
    if (s && s.split(/\s+/).length <= 5) return s
  }
  const words = t.split(/\s+/).filter((w) => !/^(a|an|the|my|our|new)$/i.test(w))
  const s = words.slice(0, 3).join(' ')
  return s || t
}

interface Ctx {
  topic: string
  T: string
  S: string
  arch: string
}

const builders: Partial<Record<SlideType, (c: Ctx, i: number) => Slide>> = {
  title: (c) => ({
    id: uid(),
    type: 'title',
    eyebrow: 'Draft outline',
    title: cap(short(c.S, 6)),
    subtitle: 'A structured first pass. Replace the placeholders with your evidence.',
    notes: `Open on the claim, not on yourself. State the argument in one sentence, then tell the room what you need from them by the end.`,
  }),

  statement: (_c, i) => ({
    id: uid(),
    type: 'statement',
    eyebrow: i < 2 ? 'The premise' : 'The turn',
    title:
      i < 2
        ? 'The current approach does not survive contact with the work.'
        : 'The constraint was never the technology.',
    subtitle:
      i < 2
        ? 'That gap is the opening. The rest of this deck is the argument for closing it.'
        : 'It was the absence of a structure that could survive contact with the real work.',
    notes: 'Let this sit. Do not narrate it — the line does the work.',
  }),

  section: () => ({
    id: uid(),
    type: 'section',
    eyebrow: 'Section',
    title: 'What changes from here',
    subtitle: 'The second half of the argument',
    notes: 'Use this as a breath, not a summary. Say what the next three slides will prove.',
  }),

  bullets: () => ({
    id: uid(),
    type: 'bullets',
    eyebrow: 'Evidence',
    title: 'Three things the current approach gets wrong',
    variant: 'numbered',
    bullets: [
      { text: 'The work is repeated, not compounded', detail: 'Every cycle restarts from zero, so quality depends on who happens to be available.' },
      { text: 'Decisions arrive after the work', detail: 'By the time the room agrees, the cost of changing course has already doubled.' },
      { text: 'The output is consistent but anonymous', detail: 'Nothing in it could only have come from you — which is why it does not persuade.' },
    ],
    notes: 'Deliver as three beats. After the third, say: "none of these are effort problems."',
  }),

  split: () => ({
    id: uid(),
    type: 'split',
    eyebrow: 'The mechanism',
    title: 'One structure, applied before the work starts',
    body: 'The claim is written first, the evidence is attached to it, and the design follows the shape of the argument rather than the other way around.',
    bullets: [{ text: 'Claim before artefact' }, { text: 'Structure before style' }],
    notes: 'Walk left to right: the written claim, then the artefact that proves it.',
  }),

  stats: () => ({
    id: uid(),
    type: 'stats',
    eyebrow: 'Signal',
    title: 'What the numbers should show',
    stats: [
      { value: '[X]×', label: 'faster to a first credible draft', note: 'replace with measured' },
      { value: '[Y]%', label: 'less time spent on formatting' },
      { value: '[Z]', label: 'weeks saved per cycle' },
    ],
    notes: 'Do not read all three. Pick the one that reframes the decision and explain it.',
  }),

  stat: () => ({
    id: uid(),
    type: 'stat',
    eyebrow: 'One number',
    title: 'The figure that reframes the conversation',
    body: 'Put the explanation beside it, never underneath. One number per slide.',
    stats: [{ value: '[X]%', label: 'of the addressable market is still unserved' }],
    notes: 'Say where the number came from before anyone asks.',
  }),

  quote: () => ({
    id: uid(),
    type: 'quote',
    quote: {
      text: 'The audience is not reading your slides. They are watching your argument.',
      author: '[Name]',
      role: '[Role, organisation]',
    },
    notes: 'Read it slowly, attribute it, then move without comment.',
  }),

  timeline: () => ({
    id: uid(),
    type: 'timeline',
    eyebrow: 'Sequence',
    title: 'How the next three quarters land',
    steps: [
      { when: 'Q1', title: 'Foundation', text: 'Define the contract, instrument the baseline.' },
      { when: 'Q2', title: 'Composition', text: 'Ship the core loop to a narrow audience.' },
      { when: 'Q3', title: 'Distribution', text: 'Expand, measure, and publish what worked.' },
    ],
    notes: 'Emphasise the dependency between phases, not the dates.',
  }),

  compare: () => ({
    id: uid(),
    type: 'compare',
    eyebrow: 'Two paths',
    title: 'What we trade for what we gain',
    columns: [
      { title: 'The default path', tone: 'muted', items: ['Consistent but anonymous', 'Content bends to the frame', 'Effort scales linearly'] },
      { title: 'The proposed path', tone: 'accent', items: ['Consistent and specific', 'The frame bends to the content', 'Effort compounds'] },
    ],
    notes: 'Argue one column at a time, then hold the contrast in silence for a beat.',
  }),

  process: () => ({
    id: uid(),
    type: 'process',
    eyebrow: 'Method',
    title: 'Four moves, in this order',
    steps: [
      { when: '01', title: 'Brief', text: 'Audience, decision, constraint.' },
      { when: '02', title: 'Outline', text: 'The narrative before any pixels.' },
      { when: '03', title: 'Compose', text: 'Layout follows content shape.' },
      { when: '04', title: 'Refine', text: 'Density, emphasis, evidence.' },
    ],
    notes: 'Step three is where most tools begin. That is the whole point.',
  }),

  chart: () => ({
    id: uid(),
    type: 'chart',
    eyebrow: 'Trend',
    title: 'The pattern the raw numbers hide',
    body: 'Replace these values with your series — the shape is the argument, not the precision.',
    chart: {
      kind: 'area',
      data: [
        { label: 'Q1', value: 32 },
        { label: 'Q2', value: 48 },
        { label: 'Q3', value: 61 },
        { label: 'Q4', value: 88 },
      ],
      caption: 'Illustrative series — replace with measured data',
    },
    notes: 'Say what the curve means in one sentence, then stop talking.',
  }),

  table: () => ({
    id: uid(),
    type: 'table',
    eyebrow: 'Detail',
    title: 'Where the options actually differ',
    table: {
      head: ['Criterion', 'Status quo', 'Proposal'],
      rows: [
        ['Time to first draft', 'Weeks', 'Days'],
        ['Design consistency', 'Depends on the author', 'Enforced by the system'],
        ['Editability', 'Manual, per slide', 'Structural, whole deck'],
        ['Cost per cycle', '[X]', '[Y]'],
      ],
      caption: 'Replace the bracketed cells with your own figures',
    },
    notes: 'Do not read the table. Point at the row that decides it.',
  }),

  matrix: () => ({
    id: uid(),
    type: 'matrix',
    eyebrow: 'Positioning',
    title: 'Where the real gap sits',
    matrix: {
      x: 'Control',
      y: 'Originality',
      items: [
        { label: 'Proposal', x: 80, y: 84 },
        { label: 'Incumbent A', x: 32, y: 44 },
        { label: 'Incumbent B', x: 58, y: 20 },
        { label: 'Status quo', x: 88, y: 14 },
      ],
    },
    bullets: [
      { text: 'The gap', detail: 'Nobody occupies the top-right corner.' },
      { text: 'Our bet', detail: 'Structure is what makes both possible.' },
    ],
    notes: 'Place the dot, then explain why nobody else can move there.',
  }),

  image: () => ({
    id: uid(),
    type: 'image',
    title: 'Let the image carry this one',
    body: 'Replace with your own photograph',
    image: {
      src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80',
      alt: 'Abstract network',
    },
    notes: 'Say nothing for three seconds. Then one sentence.',
  }),

  closing: () => ({
    id: uid(),
    type: 'closing',
    eyebrow: 'Next',
    title: 'The decision I am asking for',
    subtitle: 'A concrete next step, with a date and an owner.',
    body: 'Agree the next step',
    bullets: [{ text: 'name@company.com' }, { text: 'company.com' }],
    notes: 'End with the ask, not a thank-you. State the date.',
  }),
}

export function composeDraft(req: GenRequest): GenerateResult {
  const T = clean(req.topic || 'Your topic')
  const arc = ARCS[req.archetype] ?? ARCS.pitch
  let types = arc
  if (req.count > 0 && req.count < arc.length) types = arc.slice(0, Math.max(6, req.count))
  if (req.count > arc.length) {
    const filler: SlideType[] = ['bullets', 'statement', 'split', 'stats']
    let k = 0
    while (types.length < req.count) types = [...types.slice(0, -1), filler[k++ % filler.length], types[types.length - 1]]
  }
  const ctx: Ctx = { topic: T, T, S: subjectOf(T), arch: req.archetype }
  const slides = types
    .map((t, i) => {
      const build = builders[t] ?? builders.bullets!
      const slide = build(ctx, i)
      if (!slide.notes) slide.notes = ''
      return slide
    })
    .filter(Boolean)
  return {
    title: cap(short(subjectOf(T), 6)),
    subtitle: 'Structured draft — replace placeholders with evidence',
    slides,
  }
}
