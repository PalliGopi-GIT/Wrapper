import { store } from '../store'
import { api } from '../app/api'
import { confirmDialog, el, escapeHtml as esc, openModal, toast } from './dom'
import { icon } from './icons'

interface ShareRow {
  id: string
  token: string
  name: string | null
  access: 'signed_in' | 'invite_only'
  allowedDomains: string[]
  allowDownload: boolean
  showNotes: boolean
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  invites: string[]
}

function shareUrl(token: string): string {
  return `${location.origin}/s/${token}`
}

function statusOf(share: ShareRow): { label: string; tone: string } {
  if (share.revokedAt) return { label: 'Revoked', tone: 'off' }
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) {
    return { label: 'Expired', tone: 'off' }
  }
  return { label: 'Active', tone: 'on' }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Link copied')
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    toast('Link copied')
  }
}

export function openShare() {
  const deckId = store.deck.id
  if (!deckId) {
    toast('Save this deck before sharing it.', 'err')
    return
  }

  const card = el<HTMLDivElement>(`<div class="modal share-modal" style="max-width:640px">
    <div class="modal-head">
      <div>
        <h2>Share deck</h2>
        <p>Everyone who opens a link signs in with Clerk first. Access is checked on every request.</p>
      </div>
      <button class="icon-btn" data-close>${icon('x', 14)}</button>
    </div>
    <div class="modal-body">
      <div class="share-create">
        <div class="row">
          <div class="field">
            <label>Link name</label>
            <input class="input" data-name placeholder="e.g. Sequoia — Series A">
          </div>
          <div class="field">
            <label>Access</label>
            <select class="select" data-access>
              <option value="signed_in">Anyone signed in</option>
              <option value="invite_only">Invite only</option>
            </select>
          </div>
        </div>

        <div class="field" data-invite-fields hidden>
          <label>Allowed email domains</label>
          <input class="input" data-domains placeholder="sequoiacap.com, a16z.com">
          <div class="field-hint">Comma-separated. Leave empty to use explicit invites below.</div>
        </div>

        <div class="field" data-invite-fields hidden>
          <label>Invite emails</label>
          <input class="input" data-invites placeholder="partner@sequoiacap.com, analyst@a16z.com">
          <div class="field-hint">Comma-separated. They must sign in with this exact email.</div>
        </div>

        <div class="row">
          <div class="field">
            <label>Expires</label>
            <input class="input" type="date" data-expires>
          </div>
          <div class="field">
            <label>Options</label>
            <div class="share-checks">
              <label><input type="checkbox" data-download> Allow download</label>
              <label><input type="checkbox" data-notes> Show speaker notes</label>
            </div>
          </div>
        </div>

        <div class="share-create-foot">
          <span class="dim">Links can be revoked at any time.</span>
          <button class="btn primary" data-create>${icon('link', 13)} Create link</button>
        </div>
      </div>

      <div class="share-list-head">
        <span>Existing links</span>
        <span class="dim" data-count></span>
      </div>
      <div data-list class="share-list"><div class="dim share-loading">Loading…</div></div>
    </div>
    <div class="modal-foot">
      <div class="spacer"></div>
      <button class="btn" data-close>Done</button>
    </div>
  </div>`)

  const close = openModal(card, { center: true })
  card.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close))

  const accessEl = card.querySelector('[data-access]') as HTMLSelectElement
  const inviteFields = [...card.querySelectorAll<HTMLElement>('[data-invite-fields]')]
  const syncAccess = () => {
    const invite = accessEl.value === 'invite_only'
    inviteFields.forEach((f) => (f.hidden = !invite))
  }
  accessEl.addEventListener('change', syncAccess)
  syncAccess()

  const load = async () => {
    const list = card.querySelector('[data-list]') as HTMLElement
    try {
      const { shares } = await api<{ shares: ShareRow[] }>(`/decks/${deckId}/shares`)
      renderList(list, shares, load)
      const count = card.querySelector('[data-count]') as HTMLElement
      count.textContent = `${shares.length}`
    } catch (err) {
      list.innerHTML = `<div class="share-empty">${esc(
        err instanceof Error ? err.message : 'Could not load links'
      )}</div>`
    }
  }

  card.querySelector('[data-create]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement
    const name = (card.querySelector('[data-name]') as HTMLInputElement).value.trim()
    const access = accessEl.value as ShareRow['access']
    const domains = (card.querySelector('[data-domains]') as HTMLInputElement).value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const invites = (card.querySelector('[data-invites]') as HTMLInputElement).value
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const date = (card.querySelector('[data-expires]') as HTMLInputElement).value
    const allowDownload = (card.querySelector('[data-download]') as HTMLInputElement).checked
    const showNotes = (card.querySelector('[data-notes]') as HTMLInputElement).checked

    button.disabled = true
    button.textContent = 'Creating…'
    try {
      const { share } = await api<{ share: ShareRow }>(`/decks/${deckId}/shares`, {
        method: 'POST',
        body: JSON.stringify({
          name: name || undefined,
          access,
          allowedDomains: domains,
          invites: invites.length ? invites : undefined,
          allowDownload,
          showNotes,
          expiresAt: date ? new Date(`${date}T23:59:59Z`).toISOString() : undefined,
        }),
      })
      await copy(shareUrl(share.token))
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create the link', 'err')
    } finally {
      button.disabled = false
      button.innerHTML = `${icon('link', 13)} Create link`
    }
  })

  void load()
}

function renderList(root: HTMLElement, shares: ShareRow[], reload: () => Promise<void>) {
  if (!shares.length) {
    root.innerHTML = `<div class="share-empty">No links yet. Create one to let someone open this deck.</div>`
    return
  }

  root.innerHTML = shares
    .map((share) => {
      const status = statusOf(share)
      const url = shareUrl(share.token)
      const inviteList =
        share.access === 'invite_only'
          ? `<div class="share-invites">
              <span class="share-invites-label">Invited:</span>
              ${
                share.invites.length
                  ? share.invites.map((email) => `<span class="share-chip">${esc(email)}</span>`).join('')
                  : '<span class="dim">no one yet</span>'
              }
              ${
                share.allowedDomains.length
                  ? `<span class="share-invites-label">Domains:</span>${share.allowedDomains
                      .map((domain) => `<span class="share-chip">@${esc(domain)}</span>`)
                      .join('')}`
                  : ''
              }
            </div>`
          : ''

      return `<div class="share-row" data-share-id="${share.id}">
        <div class="share-row-head">
          <div class="share-row-name">
            <span class="share-status ${status.tone}"></span>
            <span>${esc(share.name || 'Shared deck')}</span>
            <span class="share-badge">${share.access === 'signed_in' ? 'Anyone signed in' : 'Invite only'}</span>
            <span class="share-badge ${status.tone}">${status.label}</span>
          </div>
          <div class="share-row-actions">
            <button class="btn sm" data-copy>${icon('copy', 12)} Copy</button>
            <button class="btn sm ghost" data-open>${icon('arrowUpRight', 12)} Open</button>
            ${
              share.revokedAt
                ? ''
                : `<button class="btn sm ghost" data-revoke>${icon('x', 12)} Revoke</button>`
            }
          </div>
        </div>
        <div class="share-row-url">${esc(url)}</div>
        <div class="share-row-meta">
          <span>${share.allowDownload ? 'Downloads allowed' : 'View only'}</span>
          <span>·</span>
          <span>${share.showNotes ? 'Notes shown' : 'Notes hidden'}</span>
          <span>·</span>
          <span>Created ${new Date(share.createdAt).toLocaleDateString()}</span>
          ${
            share.expiresAt
              ? `<span>· Expires ${new Date(share.expiresAt).toLocaleDateString()}</span>`
              : ''
          }
        </div>
        ${inviteList}
        ${
          share.access === 'invite_only' && !share.revokedAt
            ? `<div class="share-add-invite">
                <input class="input" data-invite-email placeholder="Add an email…">
                <button class="btn sm" data-add-invite>Invite</button>
              </div>`
            : ''
        }
      </div>`
    })
    .join('')

  root.querySelectorAll<HTMLElement>('.share-row').forEach((row) => {
    const share = shares.find((s) => s.id === row.dataset.shareId)
    if (!share) return
    const url = shareUrl(share.token)

    row.querySelector('[data-copy]')?.addEventListener('click', () => void copy(url))
    row.querySelector('[data-open]')?.addEventListener('click', () => window.open(url, '_blank'))

    row.querySelector('[data-revoke]')?.addEventListener('click', async () => {
      const ok = await confirmDialog(
        'Revoke this link?',
        'Anyone using it will lose access immediately.',
        'Revoke'
      )
      if (!ok) return
      try {
        await api(`/decks/${store.deck.id}/shares/${share.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ revoked: true }),
        })
        toast('Link revoked')
        await reload()
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not revoke', 'err')
      }
    })

    const inviteInput = row.querySelector('[data-invite-email]') as HTMLInputElement | null
    row.querySelector('[data-add-invite]')?.addEventListener('click', async () => {
      const email = inviteInput?.value.trim()
      if (!email) return
      try {
        await api(`/decks/${store.deck.id}/shares/${share.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ invites: [email] }),
        })
        toast('Invite added')
        await reload()
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not add invite', 'err')
      }
    })
  })
}
