import { store } from '../store'
import { ARCHETYPES, type GenRequest } from '../ai/prompts'
import { deckFromResult, type GenerateResult } from '../ai/generate'
import { composeDraft } from '../ai/fallback'
import { api } from '../app/api'
import { THEMES } from '../design/themes'
import { openModal, el, toast, escapeHtml as esc } from './dom'
import { icon } from './icons'

const EXAMPLES = [
  'Series A pitch for a data pipeline startup',
  'Q3 business review for a SaaS with slowing growth',
  'Conference keynote on why design systems beat templates',
  'Sales proposal for a security platform, mid-market buyer',
]

export function openGenerator(prefill = '') {
  const req: GenRequest = {
    topic: prefill,
    archetype: 'pitch',
    theme: store.deck.theme,
    count: 10,
    tone: 'direct, confident',
    audience: '',
    language: 'English',
    notes: '',
    mustInclude: '',
  }

  const card = el<HTMLDivElement>(`<div class="modal">
    <div class="modal-head">
      <div>
        <h2>Compose a deck</h2>
        <p>Give Cadence the substance. It will decide the narrative, the slide types, and the density — then hand you something editable.</p>
      </div>
      <button class="icon-btn" data-close>${icon('x', 14)}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Brief</label>
        <textarea class="textarea" data-topic style="min-height:92px" placeholder="Paste a brief, an outline, meeting notes, or just describe what needs to be decided…">${esc(prefill)}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${EXAMPLES.map((e) => `<button class="btn sm ghost" data-example="${esc(e)}" style="font-size:10.5px">${esc(e.split(' ').slice(0, 4).join(' '))}…</button>`).join('')}
        </div>
      </div>

      <div class="field">
        <label>Genre</label>
        <div class="archetype-grid">
          ${ARCHETYPES.map(
            (a) => `<button class="arch ${a.id === req.archetype ? 'on' : ''}" data-arch="${a.id}">
              <div class="t">${esc(a.name)}</div>
              <div class="d">${esc(a.blurb)}</div>
            </button>`
          ).join('')}
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Slides <span class="range-val" data-countval>10</span></label>
          <input class="range" type="range" min="6" max="16" value="10" data-count>
        </div>
        <div class="field">
          <label>Language</label>
          <input class="input" data-language value="English">
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Audience</label>
          <input class="input" data-audience placeholder="e.g. Series A investors">
        </div>
        <div class="field">
          <label>Tone</label>
          <select class="select" data-tone>
            <option>direct, confident</option>
            <option>warm, human</option>
            <option>analytical, neutral</option>
            <option>provocative, editorial</option>
            <option>technical, precise</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>Must include</label>
        <input class="input" data-must placeholder="e.g. pricing, team, $4.2B TAM, 90-day plan">
      </div>

      <div class="field">
        <label>Design system</label>
        <div class="theme-grid">
          ${THEMES.map(
            (t) => `<button class="theme-card ${t.id === req.theme ? 'on' : ''}" data-gtheme="${t.id}">
              <div class="sw">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
              <div class="nm">${t.name}</div>
              <div class="md">${t.blurb.split('.')[0]}</div>
            </button>`
          ).join('')}
        </div>
      </div>

    </div>
    <div class="modal-foot">
      <span class="dim" style="font-size:10.5px">⌘↵ to compose</span>
      <div class="spacer"></div>
      <button class="btn ghost" data-close>Cancel</button>
      <button class="btn accent" data-go>${icon('sparkle', 13)} Compose deck</button>
    </div>
  </div>`)

  const close = openModal(card, { center: true })
  const topicEl = card.querySelector('[data-topic]') as HTMLTextAreaElement
  topicEl.focus()

  card.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close))
  card.querySelectorAll('[data-example]').forEach((b) =>
    b.addEventListener('click', () => {
      topicEl.value = (b as HTMLElement).dataset.example ?? ''
      topicEl.focus()
    })
  )
  card.querySelectorAll('[data-arch]').forEach((b) =>
    b.addEventListener('click', () => {
      card.querySelectorAll('[data-arch]').forEach((x) => x.classList.remove('on'))
      b.classList.add('on')
      req.archetype = (b as HTMLElement).dataset.arch ?? 'pitch'
    })
  )
  card.querySelectorAll('[data-gtheme]').forEach((b) =>
    b.addEventListener('click', () => {
      card.querySelectorAll('[data-gtheme]').forEach((x) => x.classList.remove('on'))
      b.classList.add('on')
      req.theme = (b as HTMLElement).dataset.gtheme ?? store.deck.theme
    })
  )
  const countEl = card.querySelector('[data-count]') as HTMLInputElement
  const countVal = card.querySelector('[data-countval]') as HTMLElement
  countEl.addEventListener('input', () => {
    req.count = Number(countEl.value)
    countVal.textContent = countEl.value
  })
  const go = async () => {
    req.topic = topicEl.value.trim()
    if (!req.topic) {
      topicEl.focus()
      topicEl.style.borderColor = 'var(--ui-danger)'
      return
    }
    req.audience = (card.querySelector('[data-audience]') as HTMLInputElement).value.trim()
    req.tone = (card.querySelector('[data-tone]') as HTMLSelectElement).value
    req.language = (card.querySelector('[data-language]') as HTMLInputElement).value.trim()
    req.mustInclude = (card.querySelector('[data-must]') as HTMLInputElement).value.trim()

    close()
    store.ui.generating = true
    store.ui.generatingLabel = 'Composing the argument'
    store.emit('generate')

    const started = performance.now()
    try {
      let result: GenerateResult
      try {
        result = await api<GenerateResult>('/ai/compose', {
          method: 'POST',
          body: JSON.stringify(req),
        })
      } catch (err) {
        toast(
          err instanceof Error && err.message
            ? `${err.message} — composing an offline draft.`
            : 'Model unavailable — composing an offline draft.',
          'err',
          6000
        )
        result = await draft(req)
      }
      const deck = deckFromResult(result, {
        theme: req.theme,
        archetype: req.archetype,
        brand: store.deck.settings.brand,
      })
      deck.subtitle = deck.subtitle || result.subtitle
      store.setDeck(deck)
      store.resetHistory()
      toast(`Deck composed in ${((performance.now() - started) / 1000).toFixed(1)}s`)
    } catch (e) {
      toast((e as Error).message || 'Could not compose the deck.', 'err', 6000)
    } finally {
      store.ui.generating = false
      store.emit('generate')
    }
  }

  card.querySelector('[data-go]')?.addEventListener('click', () => void go())
  card.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void go()
    }
  })
}

function draft(req: GenRequest) {
  return new Promise<ReturnType<typeof composeDraft>>((resolve) => {
    setTimeout(() => resolve(composeDraft(req)), 700)
  })
}
