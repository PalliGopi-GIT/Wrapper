import { api } from '../app/api'
import { el, openModal, toast } from './dom'
import { icon } from './icons'

interface Health {
  ok: boolean
  ai: boolean
  db: boolean
  storage: boolean
}

export function openSettings() {
  const card = el<HTMLDivElement>(`<div class="modal" style="max-width:520px">
    <div class="modal-head">
      <div>
        <h2>Server</h2>
        <p>Cadence calls models through its own API. Provider keys never reach this browser.</p>
      </div>
      <button class="icon-btn" data-close>${icon('x', 14)}</button>
    </div>
    <div class="modal-body">
      <div class="status-list">
        <div class="status-row" data-row="ai">
          <span class="status-dot" data-dot="ai"></span>
          <span>AI Gateway</span>
          <span class="dim" data-text="ai">Checking…</span>
        </div>
        <div class="status-row" data-row="db">
          <span class="status-dot" data-dot="db"></span>
          <span>Neon Postgres</span>
          <span class="dim" data-text="db">Checking…</span>
        </div>
        <div class="status-row" data-row="storage">
          <span class="status-dot" data-dot="storage"></span>
          <span>R2 storage</span>
          <span class="dim" data-text="storage">Checking…</span>
        </div>
      </div>
      <div class="drop" style="text-align:left;display:flex;gap:10px;align-items:flex-start;margin-top:12px">
        <span style="color:var(--ui-accent)">${icon('alert', 14)}</span>
        <span style="line-height:1.55">If a service is offline, the server is missing its environment variable. Deck generation falls back to the offline composer.</span>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-test>${icon('bolt', 12)} Check connection</button>
      <div class="spacer"></div>
      <button class="btn primary" data-close>Done</button>
    </div>
  </div>`)

  const close = openModal(card, { center: true })
  card.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close))

  const paint = (health: Health) => {
    for (const key of ['ai', 'db', 'storage'] as const) {
      const on = health[key]
      const dot = card.querySelector(`[data-dot="${key}"]`) as HTMLElement
      const text = card.querySelector(`[data-text="${key}"]`) as HTMLElement
      dot.classList.toggle('on', on)
      text.textContent = on ? 'Ready' : 'Not configured'
      text.classList.toggle('dim', on)
    }
  }

  const check = async () => {
    try {
      const health = await api<Health>('/health')
      paint(health)
      toast('Server reachable')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Server unreachable', 'err')
    }
  }

  card.querySelector('[data-test]')?.addEventListener('click', () => void check())
  void check()
}
