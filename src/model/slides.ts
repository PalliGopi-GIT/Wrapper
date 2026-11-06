import type { Deck, Slide, SlideType } from './types'
import { defaultSettings } from './types'
import { uid } from '../store'

export function newSlide(type: SlideType): Slide {
  const base: Slide = { id: uid(), type, notes: '' }
  switch (type) {
    case 'title':
      return { ...base, eyebrow: 'Company / 2026', title: 'A title that earns the next ten minutes', subtitle: 'One line of context that tells the room what they are about to see.' }
    case 'section':
      return { ...base, title: 'Part two', subtitle: 'What changes when the constraints change' }
    case 'statement':
      return { ...base, eyebrow: 'The premise', title: 'The argument, stated once, without decoration.' }
    case 'bullets':
      return {
        ...base,
        eyebrow: 'Evidence',
        title: 'Three things that hold up under scrutiny',
        bullets: [
          { text: 'Lead with the claim', detail: 'The supporting detail belongs underneath, in a smaller voice.' },
          { text: 'One idea per slide', detail: 'If you need a comma to describe the layout, it is two slides.' },
          { text: 'End on the consequence', detail: 'What changes for the audience if this is true.' },
        ],
      }
    case 'split':
      return {
        ...base,
        eyebrow: 'Detail',
        title: 'A section that pairs claim with artifact',
        body: 'Use the panel for a product frame, a photograph, or the single number that carries the argument.',
        bullets: [{ text: 'Panel can hold an image' }, { text: 'Or a hero metric' }],
      }
    case 'stats':
      return {
        ...base,
        eyebrow: 'Signal',
        title: 'What the numbers say',
        stats: [
          { value: '3.4×', label: 'Faster to a first draft', note: 'median, 40 decks' },
          { value: '68%', label: 'Less time formatting' },
          { value: '12', label: 'Design systems, one structure' },
        ],
      }
    case 'stat':
      return {
        ...base,
        eyebrow: 'One number',
        title: 'The single figure that reframes the conversation',
        body: 'Put the explanation beside it, never underneath.',
        stats: [{ value: '94%', label: 'of decks are forgotten within a week' }],
      }
    case 'quote':
      return {
        ...base,
        quote: { text: 'Design is not decoration. It is the shortest path between an idea and a decision.', author: 'Ada Lovelace', role: 'on clarity' },
      }
    case 'timeline':
      return {
        ...base,
        eyebrow: 'Plan',
        title: 'How the next three quarters land',
        steps: [
          { when: 'Q1', title: 'Foundation', text: 'Instrument the system, define the design contract.' },
          { when: 'Q2', title: 'Composition', text: 'Ship the layout engine and the theme library.' },
          { when: 'Q3', title: 'Distribution', text: 'Exports, collaboration, and the open format.' },
        ],
      }
    case 'compare':
      return {
        ...base,
        eyebrow: 'Two paths',
        title: 'What we trade for what we gain',
        columns: [
          { title: 'Template thinking', tone: 'muted', items: ['Consistent but anonymous', 'Content bends to the frame', 'Every deck looks like the last one'] },
          { title: 'System thinking', tone: 'accent', items: ['Consistent and specific', 'The frame bends to the content', 'The deck looks like the argument'] },
        ],
      }
    case 'process':
      return {
        ...base,
        eyebrow: 'Method',
        title: 'Four moves, in order',
        steps: [
          { when: '01', title: 'Brief', text: 'Audience, decision, constraint.' },
          { when: '02', title: 'Outline', text: 'The narrative before the pixels.' },
          { when: '03', title: 'Compose', text: 'Layouts chosen by content shape.' },
          { when: '04', title: 'Refine', text: 'Density, emphasis, evidence.' },
        ],
      }
    case 'chart':
      return {
        ...base,
        eyebrow: 'Trend',
        title: 'Retention follows structure, not volume',
        body: 'Attention decays fastest between slide four and slide seven.',
        chart: {
          kind: 'area',
          data: [
            { label: 'Open', value: 92 },
            { label: 'Problem', value: 96 },
            { label: 'Solution', value: 81 },
            { label: 'Proof', value: 64 },
            { label: 'Ask', value: 42 },
          ],
          caption: 'Audience attention by narrative beat',
          suffix: '%',
        },
      }
    case 'table':
      return {
        ...base,
        eyebrow: 'Comparison',
        title: 'Where the options actually differ',
        table: {
          head: ['Capability', 'Template tools', 'Cadence'],
          rows: [
            ['Layout logic', 'Content poured into frames', 'Frames chosen by content'],
            ['Themes', 'Colour swaps', 'Full typographic systems'],
            ['PowerPoint export', 'Rasterised or broken', 'Native, editable shapes'],
            ['Editing depth', 'Per slide', 'Whole deck at once'],
          ],
        },
      }
    case 'matrix':
      return {
        ...base,
        eyebrow: 'Positioning',
        title: 'Originality against control',
        matrix: {
          x: 'Design control',
          y: 'Original output',
          items: [
            { label: 'Cadence', x: 82, y: 88 },
            { label: 'Moda', x: 76, y: 62 },
            { label: 'Gamma', x: 34, y: 44 },
            { label: 'Canva', x: 58, y: 18 },
            { label: 'PowerPoint', x: 88, y: 12 },
          ],
        },
        bullets: [
          { text: 'The gap', detail: 'Tools force a choice between original and controlled.' },
          { text: 'Our bet', detail: 'A design system resolves both.' },
        ],
      }
    case 'image':
      return {
        ...base,
        title: 'Full-bleed images carry the argument alone',
        body: 'Caption or source line',
        image: { src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80', alt: 'Mountain range at dusk' },
      }
    case 'closing':
      return {
        ...base,
        title: 'Let us build the argument together.',
        subtitle: 'The deck is the easy part. The thinking is the work.',
        body: 'Start a deck',
        bullets: [{ text: 'hello@cadence.studio' }, { text: 'cadence.studio' }],
      }
  }
}

/* --------------------------------------------------------------- */

export function demoDeck(theme = 'obsidian'): Deck {
  const slides: Slide[] = [
    {
      id: uid(),
      type: 'title',
      eyebrow: 'Cadence Studio — 2026',
      title: 'Beyond templates',
      subtitle: 'A working theory of presentation design, and the software that follows from it.',
      notes:
        'Open by naming the problem: everyone has a deck tool, nobody has a deck. Set the frame that this is about structure and design systems, not about faster slide-making.',
    },
    {
      id: uid(),
      type: 'statement',
      eyebrow: 'The premise',
      title: 'Most decks fail before the first slide is drawn.',
      subtitle:
        'Not because the design is ugly — because the argument was never structured. Design cannot rescue an outline that has no spine.',
      notes: 'Pause here. Let the statement sit for a beat before advancing.',
    },
    {
      id: uid(),
      type: 'bullets',
      eyebrow: 'What survives',
      title: 'Four things an audience actually takes home',
      variant: 'numbered',
      bullets: [
        { text: 'One claim they can repeat', detail: 'If they cannot say it back in a single sentence, it did not land.' },
        { text: 'One number that reframes the problem', detail: 'A figure does more work than a paragraph of context.' },
        { text: 'One visual they could redraw from memory', detail: 'Structure is remembered; ornament is not.' },
        { text: 'One action that costs them something', detail: 'A decision, not a sentiment.' },
      ],
      notes: 'Deliver these as a list of four, then say: "everything else is decoration."',
    },
    {
      id: uid(),
      type: 'stats',
      eyebrow: 'Signal',
      title: 'The cost of getting the structure wrong',
      stats: [
        { value: '7s', label: 'before an audience decides whether to keep listening', note: 'first impression' },
        { value: '3.4×', label: 'more recall when a claim is paired with a visual', note: 'vs. text alone' },
        { value: '41%', label: 'of deck time is spent on formatting, not thinking', note: '2025 survey' },
      ],
      notes: 'Numbers are illustrative for the demo. Replace with your own evidence.',
    },
    {
      id: uid(),
      type: 'chart',
      eyebrow: 'Attention',
      title: 'Attention follows the narrative, not the slide count',
      body: 'The drop between proof and ask is where most decks lose the room.',
      chart: {
        kind: 'area',
        data: [
          { label: 'Open', value: 92 },
          { label: 'Problem', value: 97 },
          { label: 'Solution', value: 84 },
          { label: 'Proof', value: 66 },
          { label: 'Ask', value: 38 },
        ],
        caption: 'Retention by narrative beat — index',
        suffix: '%',
      },
      notes: 'Point at the last segment. The ask lands on tired attention; that is a structural problem, not a content one.',
    },
    {
      id: uid(),
      type: 'compare',
      eyebrow: 'Two ways',
      title: 'Templates produce consistency. Systems produce meaning.',
      columns: [
        {
          title: 'Template thinking',
          tone: 'muted',
          items: [
            'Content is poured into a fixed frame',
            'Every deck converges on the same silhouette',
            'Design decisions are made before the argument',
            'Consistency without specificity',
          ],
        },
        {
          title: 'System thinking',
          tone: 'accent',
          items: [
            'The frame is chosen by the shape of the content',
            'Decks stay related but never identical',
            'Design decisions follow the narrative',
            'Consistency with a point of view',
          ],
        },
      ],
      notes: 'This is the thesis slide. Slow down.',
    },
    {
      id: uid(),
      type: 'process',
      eyebrow: 'Method',
      title: 'Four moves, in this order',
      steps: [
        { when: '01', title: 'Brief', text: 'Audience, decision, constraint. Written in one paragraph.' },
        { when: '02', title: 'Outline', text: 'The narrative before a single pixel exists.' },
        { when: '03', title: 'Compose', text: 'Layouts selected by content shape, not by habit.' },
        { when: '04', title: 'Refine', text: 'Density, emphasis, and the evidence that earns the claim.' },
      ],
      notes: 'Emphasise that step three is where most tools start — which is why their output is interchangeable.',
    },
    {
      id: uid(),
      type: 'quote',
      quote: {
        text: 'The audience is not reading your slides. They are watching your argument.',
        author: 'Anonymous creative director',
        role: 'quoted in a studio review',
      },
      notes: 'Read it slowly, then move without comment.',
    },
    {
      id: uid(),
      type: 'matrix',
      eyebrow: 'Positioning',
      title: 'Originality versus control',
      matrix: {
        x: 'Design control',
        y: 'Original output',
        items: [
          { label: 'Cadence', x: 80, y: 86 },
          { label: 'Moda', x: 74, y: 58 },
          { label: 'Gamma', x: 32, y: 46 },
          { label: 'Canva', x: 56, y: 20 },
          { label: 'PowerPoint', x: 90, y: 14 },
        ],
      },
      bullets: [
        { text: 'The gap', detail: 'Tools force a choice between original output and reliable control.' },
        { text: 'Our bet', detail: 'A design system can deliver both at once.' },
      ],
      notes: 'Place the dot where you want the audience to place you, not where you currently are.',
    },
    {
      id: uid(),
      type: 'table',
      eyebrow: 'Detail',
      title: 'Where the options actually differ',
      table: {
        head: ['Capability', 'Template tools', 'Cadence'],
        rows: [
          ['Layout logic', 'Content poured into frames', 'Frames chosen by content'],
          ['Themes', 'Colour swaps', 'Full typographic systems'],
          ['PowerPoint export', 'Rasterised or broken', 'Native, editable shapes'],
          ['Editing depth', 'One slide at a time', 'Whole deck at once'],
        ],
        caption: 'Capabilities as of 2026',
      },
      notes: 'Use the right column as the punchline, not the whole table.',
    },
    {
      id: uid(),
      type: 'closing',
      eyebrow: 'Next',
      title: 'Let us build the argument together.',
      subtitle: 'The deck is the easy part. The thinking is the work.',
      body: 'Start a deck',
      bullets: [{ text: 'hello@cadence.studio' }, { text: 'cadence.studio' }],
      notes: 'End on the invitation, not the summary.',
    },
  ]

  return {
    id: uid(),
    title: 'Beyond templates',
    subtitle: 'A working theory of presentation design',
    theme,
    archetype: 'keynote',
    slides,
    settings: { ...defaultSettings(), brand: 'Cadence Studio' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
