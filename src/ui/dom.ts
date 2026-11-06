import { icons, icon } from './icons'

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as T
}

export function qs<T extends Element = Element>(root: ParentNode, sel: string): T | null {
  return root.querySelector<T>(sel)
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: number | undefined
  return ((...args: never[]) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }) as T
}

export function iconSvg(name: keyof typeof icons, size = 14): string {
  return icons[name](size)
}

/* ------------------------------- toasts ------------------------------- */

let toastRoot: HTMLElement | null = null

export function toast(message: string, kind: 'ok' | 'err' | 'info' = 'ok', ms = 3200) {
  if (!toastRoot) {
    toastRoot = el('<div class="toasts"></div>')
    document.body.appendChild(toastRoot)
  }
  const node = el<HTMLDivElement>(`<div class="toast ${kind === 'err' ? 'err' : ''}">
    <span class="ico">${kind === 'err' ? icon('alert', 14) : kind === 'info' ? icon('sparkle', 14) : icon('check', 14)}</span>
    <span>${escapeHtml(message)}</span>
  </div>`)
  toastRoot.appendChild(node)
  setTimeout(() => {
    node.style.transition = 'opacity 180ms ease, transform 180ms ease'
    node.style.opacity = '0'
    node.style.transform = 'translateY(6px)'
    setTimeout(() => node.remove(), 200)
  }, ms)
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}

/* ------------------------------- popover ------------------------------- */

export interface MenuItem {
  label?: string
  icon?: keyof typeof icons
  hint?: string
  danger?: boolean
  sep?: boolean
  onClick?: () => void
}

let openPopover: HTMLElement | null = null
let popoverCleanup: (() => void) | null = null

export function closePopover() {
  openPopover?.remove()
  openPopover = null
  popoverCleanup?.()
  popoverCleanup = null
}

export function popover(anchor: HTMLElement, items: MenuItem[], opts: { align?: 'left' | 'right'; width?: number } = {}) {
  const isSame = !!openPopover && openPopover.dataset.anchor === anchor.dataset.popId
  closePopover()
  if (isSame) return
  if (!anchor.dataset.popId) anchor.dataset.popId = Math.random().toString(36).slice(2)

  const menu = el<HTMLDivElement>(`<div class="popover" style="min-width:${opts.width ?? 200}px">
    ${items
      .map((it, i) =>
        it.sep
          ? '<div class="pop-sep"></div>'
          : `<button class="pop-item ${it.danger ? 'danger' : ''}" data-i="${i}">
              <span class="pi">${it.icon ? icon(it.icon, 13) : ''}</span>
              <span class="pl">${escapeHtml(it.label ?? '')}</span>
              ${it.hint ? `<span class="pk">${escapeHtml(it.hint)}</span>` : ''}
            </button>`
      )
      .join('')}
  </div>`)
  menu.dataset.anchor = anchor.dataset.popId
  menu.style.position = 'fixed'
  document.body.appendChild(menu)
  openPopover = menu

  const r = anchor.getBoundingClientRect()
  const mw = menu.offsetWidth
  const mh = menu.offsetHeight
  let left = opts.align === 'right' ? r.right - mw : r.left
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8))
  let top = r.bottom + 6
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6)
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`

  menu.querySelectorAll<HTMLButtonElement>('.pop-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const item = items[Number(btn.dataset.i)]
      closePopover()
      item?.onClick?.()
    })
  })

  const onDown = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) closePopover()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePopover()
  }
  setTimeout(() => document.addEventListener('mousedown', onDown), 0)
  document.addEventListener('keydown', onKey)
  popoverCleanup = () => {
    document.removeEventListener('mousedown', onDown)
    document.removeEventListener('keydown', onKey)
  }
}

/* ------------------------------- modal ------------------------------- */

export function openModal(content: HTMLElement, opts: { onClose?: () => void; center?: boolean } = {}) {
  const overlay = el<HTMLDivElement>(`<div class="overlay ${opts.center ? 'center' : ''}"></div>`)
  overlay.appendChild(content)
  document.body.appendChild(overlay)
  const close = () => {
    overlay.style.opacity = '0'
    overlay.style.transition = 'opacity 120ms ease'
    setTimeout(() => overlay.remove(), 130)
    document.removeEventListener('keydown', onKey)
    opts.onClose?.()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close()
  })
  return close
}

export function confirmDialog(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    const card = el<HTMLDivElement>(`<div class="modal" style="max-width:420px">
      <div class="modal-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></div>
      <div class="modal-foot">
        <div class="spacer"></div>
        <button class="btn ghost" data-x>Cancel</button>
        <button class="btn primary" data-ok>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`)
    let done = false
    const close = openModal(card, {
      center: true,
      onClose: () => {
        if (!done) {
          done = true
          resolve(false)
        }
      },
    })
    card.querySelector('[data-x]')?.addEventListener('click', () => close())
    card.querySelector('[data-ok]')?.addEventListener('click', () => {
      done = true
      close()
      resolve(true)
    })
  })
}
