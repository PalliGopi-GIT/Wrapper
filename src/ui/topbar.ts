import { store } from '../store'
import { getTheme } from '../design/themes'
import { icon, type IconName } from './icons'
import { popover } from './dom'
import { runExport, type ExportKind } from './exports'
import { openGenerator } from './generator'
import { openPresenter } from './presenter'
import { openSettings } from './settings'
import { openPalette } from './command'
import { openShare } from './share'

let saveTimer: number | undefined

export function mountTopbar(root: HTMLElement) {
  root.innerHTML = `
    <div class="brandmark">
      <span class="glyph">C</span>
      <span class="name">Cadence</span>
    </div>
    <div class="top-sep"></div>
    <div class="doc-title">
      <input data-title spellcheck="false" aria-label="Deck title">
      <span class="saved" data-saved></span>
    </div>
    <button class="chip" data-theme-chip title="Change design system">
      <span class="dot" data-theme-dot></span>
      <span data-theme-name></span>
      ${icon('chevron', 11)}
    </button>

    <div class="top-spacer"></div>

    <button class="icon-btn" data-undo title="Undo (⌘Z)">${icon('undo', 15)}</button>
    <button class="icon-btn" data-redo title="Redo (⇧⌘Z)">${icon('redo', 15)}</button>
    <div class="top-sep"></div>
    <button class="icon-btn" data-palette title="Command palette (⌘K)">${icon('command', 15)}</button>
    <button class="icon-btn" data-settings-btn title="Model settings">${icon('sliders', 15)}</button>
    <div class="top-sep"></div>
    <button class="btn" data-share>${icon('share', 13)} Share</button>
    <button class="btn" data-present>${icon('present', 13)} Present</button>
    <button class="btn accent" data-generate>${icon('sparkle', 13)} Compose</button>
    <button class="btn primary" data-export>${icon('download', 13)} Export ${icon('chevron', 11)}</button>
  `

  const titleEl = root.querySelector('[data-title]') as HTMLInputElement
  titleEl.addEventListener('focus', () => store.snapshot(), { once: true })
  titleEl.addEventListener('input', () => {
    store.deck.title = titleEl.value
    store.emit('inline')
  })

  root.querySelector('[data-palette]')?.addEventListener('click', () => openPalette())
  root.querySelector('[data-settings-btn]')?.addEventListener('click', () => openSettings())
  root.querySelector('[data-present]')?.addEventListener('click', () => openPresenter())
  root.querySelector('[data-share]')?.addEventListener('click', () => openShare())
  root.querySelector('[data-generate]')?.addEventListener('click', () => openGenerator())
  root.querySelector('[data-undo]')?.addEventListener('click', () => store.undo())
  root.querySelector('[data-redo]')?.addEventListener('click', () => store.redo())
  root.querySelector('[data-theme-chip]')?.addEventListener('click', () => {
    store.ui.tab = 'design'
    store.ui.inspectorOpen = true
    store.emit('ui')
  })

  root.querySelector('[data-export]')?.addEventListener('click', (e) => {
    popover(e.currentTarget as HTMLElement, exportMenu(), { align: 'right', width: 268 })
  })
}

function exportMenu() {
  const go = (kind: ExportKind) => () => void runExport(kind)
  return [
    {
      label: 'PowerPoint (.pptx)',
      icon: 'file' as IconName,
      hint: 'server',
      onClick: go('pptx-server'),
    },
    {
      label: 'PowerPoint (offline)',
      icon: 'file' as IconName,
      hint: 'client',
      onClick: go('pptx'),
    },
    { sep: true },
    { label: 'PDF — print quality', icon: 'download' as IconName, hint: 'vector', onClick: go('pdf-print') },
    { label: 'PDF — direct download', icon: 'download' as IconName, hint: 'raster', onClick: go('pdf-download') },
    { label: 'PNG images', icon: 'image' as IconName, hint: '.zip', onClick: go('png') },
    { sep: true },
    { label: 'Standalone HTML', icon: 'layout' as IconName, onClick: go('html') },
    { label: 'Markdown + notes', icon: 'note' as IconName, onClick: go('markdown') },
    { label: 'Project file (.json)', icon: 'file' as IconName, onClick: go('project') },
  ]
}

export function renderTopbar() {
  const root = document.querySelector('.topbar') as HTMLElement | null
  if (!root) return
  const titleEl = root.querySelector('[data-title]') as HTMLInputElement
  if (titleEl && document.activeElement !== titleEl) titleEl.value = store.deck.title

  const theme = getTheme(store.deck.theme)
  const name = root.querySelector('[data-theme-name]')
  if (name) name.textContent = theme.name
  const dot = root.querySelector('[data-theme-dot]') as HTMLElement | null
  if (dot) dot.style.background = store.deck.settings.accent || theme.color.accent

  const undo = root.querySelector('[data-undo]') as HTMLButtonElement | null
  const redo = root.querySelector('[data-redo]') as HTMLButtonElement | null
  if (undo) undo.style.opacity = store.canUndo() ? '1' : '0.35'
  if (redo) redo.style.opacity = store.canRedo() ? '1' : '0.35'

  const saved = root.querySelector('[data-saved]') as HTMLElement | null
  if (saved) {
    saved.textContent = 'Saved'
    saved.style.opacity = '1'
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saved.style.transition = 'opacity 400ms ease'
      saved.style.opacity = '0.25'
    }, 1200)
  }
}
