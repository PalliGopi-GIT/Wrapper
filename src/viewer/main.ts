import '../styles/app.css'
import '../styles/slide.css'

import type { Deck } from '../model/types'
import { renderSlide, autofit } from '../render/slide'
import { api, ApiError } from '../app/api'
import { clerk, clerkAppearance, initClerk, showStartupError, clerkReady, isSignedIn } from '../app/auth'

interface Gate {
  ownerName: string
  brand: string
  requiresInvite: boolean
}

interface ShareResponse {
  deck: Deck
  share: {
    name: string | null
    access: 'signed_in' | 'invite_only'
    allowDownload: boolean
    showNotes: boolean
  }
}

const app = document.getElementById('app') as HTMLElement

const token = location.pathname.match(/^\/s\/([^/]+)/)?.[1]
const mode = new URLSearchParams(location.search).get('mode')

await initClerk().catch((error: unknown) => {
  showStartupError(app, error)
})

if (!clerkReady()) {
  // Startup error is already rendered.
} else if (!token) {
  renderFatal('This share link is invalid.')
} else if (!isSignedIn()) {
  void renderGate()
} else {
  void loadDeck()
}

async function renderGate() {
  let gate: Gate = { ownerName: 'Someone', brand: '', requiresInvite: false }
  try {
    const res = await fetch(`/api/share/${token}/gate`)
    if (res.ok) gate = (await res.json()) as Gate
  } catch {
    /* gate details are non-critical */
  }

  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-inner">
        <div class="auth-brand"><span class="glyph">C</span><span class="auth-name">Cadence</span></div>
        <p class="auth-lede"><strong>${escape(gate.ownerName)}</strong> shared a presentation with you.</p>
        <div class="auth-card" id="clerk-auth"></div>
        <p class="auth-foot">${
          gate.requiresInvite
            ? 'This deck is invite-only. Sign in with the address that was invited.'
            : 'Sign in to open this deck.'
        }</p>
        <div class="gate-switch">
          <button data-mode="sign-in">Sign in</button>
          <span>·</span>
          <button data-mode="sign-up">Create account</button>
        </div>
      </div>
    </div>`

  const target = document.getElementById('clerk-auth') as HTMLDivElement
  const redirect = `/s/${token}`
  const initial = mode === 'sign-up' ? 'sign-up' : 'sign-in'

  const mount = (kind: 'sign-in' | 'sign-up') => {
    target.replaceChildren()
    if (kind === 'sign-in') {
      clerk().mountSignIn(target, {
        appearance: clerkAppearance,
        fallbackRedirectUrl: redirect,
      })
    } else {
      clerk().mountSignUp(target, {
        appearance: clerkAppearance,
        fallbackRedirectUrl: redirect,
        unsafeMetadata: { source: 'share', shareToken: token },
      })
    }
  }

  mount(initial)
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => mount(button.dataset.mode as 'sign-in' | 'sign-up'))
  })
}

async function loadDeck() {
  let data: ShareResponse
  try {
    data = await api<ShareResponse>(`/share/${token}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      renderFatal('Ask the owner for access to this deck.')
    } else if (err instanceof ApiError && err.status === 404) {
      renderFatal('This link is no longer active.')
    } else {
      renderFatal(err instanceof Error ? err.message : 'Could not open this deck.')
    }
    return
  }

  renderViewer(data)
}

function renderViewer({ deck, share }: ShareResponse) {
  document.title = `${deck.title} — Cadence`

  app.innerHTML = `
    <div class="viewer">
      <header class="viewer-bar">
        <div class="viewer-title">${escape(deck.title)}</div>
        <div class="spacer"></div>
        <span class="viewer-count" data-count></span>
        <button class="icon-btn" data-prev title="Previous slide">←</button>
        <button class="icon-btn" data-next title="Next slide">→</button>
        <button class="icon-btn" data-full title="Fullscreen">⤢</button>
        ${share.allowDownload ? '<button class="btn" data-download>Download</button>' : ''}
      </header>
      <main class="viewer-stage" data-stage></main>
      <footer class="viewer-foot">
        <span>${escape(share.name || 'Shared presentation')}</span>
        <span class="dim">${share.showNotes ? 'Speaker notes included' : 'View only'}</span>
      </footer>
    </div>`

  const stage = app.querySelector('[data-stage]') as HTMLElement
  const count = app.querySelector('[data-count]') as HTMLElement
  let index = 0
  let node: HTMLElement | null = null

  const sessionId = crypto.randomUUID()
  let enteredAt = Date.now()
  let lastSlideId = deck.slides[0]?.id ?? ''

  const sendEvent = () => {
    const payload = {
      sessionId,
      slideId: lastSlideId,
      ms: Math.max(0, Date.now() - enteredAt),
      maxSlide: index,
    }
    enteredAt = Date.now()
    void api(`/share/${token}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  const fit = () => {
    if (!node) return
    const availW = stage.clientWidth - 64
    const availH = stage.clientHeight - 64
    const scale = Math.max(0.2, Math.min(availW / 1280, availH / 720))
    node.style.transform = `scale(${scale})`
    const holder = node.parentElement
    if (holder) {
      holder.style.width = `${1280 * scale}px`
      holder.style.height = `${720 * scale}px`
    }
  }

  const show = (next: number) => {
    const clamped = Math.max(0, Math.min(deck.slides.length - 1, next))
    if (clamped === index && node) return
    if (node) sendEvent()
    index = clamped
    const slide = deck.slides[index]
    if (!slide) return

    const holder = document.createElement('div')
    holder.className = 'viewer-frame'
    node = renderSlide(slide, deck, index, deck.slides.length)
    node.style.transformOrigin = '0 0'
    holder.appendChild(node)
    stage.replaceChildren(holder)
    autofit(node)
    requestAnimationFrame(fit)

    lastSlideId = slide.id
    enteredAt = Date.now()
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(
      deck.slides.length
    ).padStart(2, '0')}`
  }

  app.querySelector('[data-prev]')?.addEventListener('click', () => show(index - 1))
  app.querySelector('[data-next]')?.addEventListener('click', () => show(index + 1))
  app.querySelector('[data-full]')?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  })
  app.querySelector('[data-download]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug(deck.title)}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault()
      show(index + 1)
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      show(index - 1)
    }
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    }
  })

  window.addEventListener('resize', fit)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendEvent()
  })
  window.addEventListener('pagehide', sendEvent)
  window.setInterval(sendEvent, 15_000)

  fit()
  show(0)
}

function renderFatal(message: string) {
  app.innerHTML = `
    <div class="app-error">
      <div class="auth-brand"><span class="glyph">C</span><span class="auth-name">Cadence</span></div>
      <h2>Presentation unavailable</h2>
      <p>${escape(message)}</p>
    </div>`
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cadence-deck'
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}
