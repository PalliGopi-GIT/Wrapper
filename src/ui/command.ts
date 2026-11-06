import { store } from '../store'
import { THEMES } from '../design/themes'
import { newSlide } from '../model/slides'
import { icon, type IconName } from './icons'
import { el, escapeHtml as esc } from './dom'
import { openGenerator } from './generator'
import { openPresenter } from './presenter'
import { openSettings } from './settings'
import { runExport } from './exports'
import { slideMenu } from './rail'
import { rewriteSlide } from './ai-actions'
import { popover } from './dom'
import { toggleSorter } from './sorter'

interface Cmd {
  id: string
  label: string
  group: string
  hint?: string
  icon: IconName
  run: () => void
}

let overlay: HTMLElement | null = null

export function closePalette() {
  overlay?.remove()
  overlay = null
  store.ui.paletteOpen = false
}

export function openPalette() {
  if (overlay) return closePalette()
  store.ui.paletteOpen = true
  const cmds = buildCommands()
  let active = 0
  let filtered = cmds

  overlay = el<HTMLDivElement>(`<div class="overlay">
    <div class="palette" role="dialog" aria-label="Command palette">
      <div class="palette-input">
        ${icon('command', 15)}
        <input placeholder="Search actions, slides, themes…" autocomplete="off" spellcheck="false">
        <span class="kbd">esc</span>
      </div>
      <div class="palette-list"></div>
    </div>
  </div>`)
  document.body.appendChild(overlay)

  const input = overlay.querySelector('input') as HTMLInputElement
  const list = overlay.querySelector('.palette-list') as HTMLElement
  input.focus()

  const paint = () => {
    const groups: string[] = []
    list.innerHTML = ''
    filtered.slice(0, 60).forEach((c, i) => {
      if (!groups.includes(c.group)) {
        groups.push(c.group)
        list.appendChild(el(`<div class="palette-group">${esc(c.group)}</div>`))
      }
      const row = el<HTMLButtonElement>(`<button class="palette-item ${i === active ? 'on' : ''}" data-i="${i}">
        ${icon(c.icon, 14)}
        <span>${esc(c.label)}</span>
        ${c.hint ? `<span class="k">${esc(c.hint)}</span>` : ''}
      </button>`)
      row.addEventListener('click', () => {
        closePalette()
        c.run()
      })
      row.addEventListener('mousemove', () => {
        if (active !== i) {
          active = i
          list.querySelectorAll('.palette-item').forEach((n, j) => n.classList.toggle('on', j === i))
        }
      })
      list.appendChild(row)
    })
    if (!filtered.length) {
      list.appendChild(el(`<div class="palette-group">No matches</div>`))
    }
    requestAnimationFrame(() => list.querySelector('.palette-item.on')?.scrollIntoView({ block: 'nearest' }))
  }

  const applyFilter = (q: string) => {
    const query = q.trim().toLowerCase()
    filtered = !query
      ? cmds
      : cmds.filter((c) => score(`${c.group} ${c.label}`, query) > 0).sort((a, b) => score(`${a.group} ${a.label}`, query) - score(`${b.group} ${b.label}`, query))
    active = 0
    paint()
  }

  input.addEventListener('input', () => applyFilter(input.value))
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = Math.min(filtered.length - 1, active + 1)
      paint()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = Math.max(0, active - 1)
      paint()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[active]
      if (cmd) {
        closePalette()
        cmd.run()
      }
    }
  })

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closePalette()
  })

  paint()
}

function score(text: string, query: string): number {
  const t = text.toLowerCase()
  if (t.includes(query)) return t.indexOf(query)
  let i = 0
  for (const ch of t) {
    if (ch === query[i]) i++
    if (i === query.length) return 100
  }
  return -1
}

function buildCommands(): Cmd[] {
  const cmds: Cmd[] = [
    {
      id: 'compose',
      label: 'Compose a deck',
      group: 'Compose',
      icon: 'sparkle',
      hint: '⌘↵',
      run: () => openGenerator(),
    },
    {
      id: 'rewrite',
      label: 'Rewrite this slide',
      group: 'Compose',
      icon: 'refresh',
      run: () => {
        const id = store.slide?.id
        if (id) void rewriteSlide(id, 'Tighten this slide. Make the claim sharper and cut anything that does not carry it.')
      },
    },
    {
      id: 'add',
      label: 'Add slide…',
      group: 'Compose',
      icon: 'plus',
      run: () => {
        const anchor = document.querySelector('.rail-foot [data-add]') as HTMLElement | null
        if (anchor) {
          anchor.click()
          void 0
        } else {
          const menu = slideMenu()
          popover(document.body, menu, { align: 'left' })
        }
      },
    },
    {
      id: 'theme-random',
      label: 'Surprise me with a theme',
      group: 'Design',
      icon: 'palette',
      run: () => {
        const current = store.deck.theme
        const pool = THEMES.filter((t) => t.id !== current)
        const next = pool[Math.floor(Math.random() * pool.length)]
        store.mutate((d) => {
          d.theme = next.id
          d.settings.accent = null
          d.settings.radius = -1
        }, { kind: 'theme' })
      },
    },
    {
      id: 'present',
      label: 'Present',
      group: 'Present',
      icon: 'present',
      hint: 'P',
      run: () => openPresenter(),
    },
    {
      id: 'overview',
      label: 'Slide overview',
      group: 'View',
      icon: 'grid',
      hint: 'G',
      run: () => toggleSorter(),
    },
    {
      id: 'toggle-rail',
      label: 'Toggle slide rail',
      group: 'View',
      icon: 'layout',
      hint: '⌘1',
      run: () => {
        store.ui.railOpen = !store.ui.railOpen
        store.emit('ui')
      },
    },
    {
      id: 'toggle-insp',
      label: 'Toggle inspector',
      group: 'View',
      icon: 'sliders',
      hint: '⌘2',
      run: () => {
        store.ui.inspectorOpen = !store.ui.inspectorOpen
        store.emit('ui')
      },
    },
    {
      id: 'undo',
      label: 'Undo',
      group: 'Edit',
      icon: 'undo',
      hint: '⌘Z',
      run: () => store.undo(),
    },
    {
      id: 'redo',
      label: 'Redo',
      group: 'Edit',
      icon: 'redo',
      hint: '⇧⌘Z',
      run: () => store.redo(),
    },
    {
      id: 'dupe',
      label: 'Duplicate slide',
      group: 'Edit',
      icon: 'copy',
      run: () => {
        if (store.slide) store.duplicateSlide(store.slide.id)
      },
    },
    {
      id: 'delete',
      label: 'Delete slide',
      group: 'Edit',
      icon: 'trash',
      run: () => {
        if (store.slide && store.deck.slides.length > 1) store.removeSlide(store.slide.id)
      },
    },
    {
      id: 'share',
      label: 'Share deck…',
      group: 'Share',
      icon: 'share',
      run: () => void import('./share').then((m) => m.openShare()),
    },
    {
      id: 'connect',
      label: 'Server status',
      group: 'Setup',
      icon: 'bolt',
      run: () => openSettings(),
    },
    {
      id: 'import',
      label: 'Import project…',
      group: 'Setup',
      icon: 'file',
      run: () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,application/json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          const { loadProject } = await import('../export/project')
          try {
            store.setDeck(await loadProject(file))
          } catch (e) {
            console.error(e)
          }
        }
        input.click()
      },
    },
  ]

  for (const [kind, label, hint] of [
    ['pptx-server', 'Export PowerPoint (server)', 'native'],
    ['pptx', 'Export PowerPoint (offline)', 'native'],
    ['pdf-print', 'Export PDF (print)', 'vector'],
    ['pdf-download', 'Export PDF (direct)', ''],
    ['png', 'Export PNG images', 'zip'],
    ['html', 'Export standalone HTML', ''],
    ['markdown', 'Export Markdown + notes', ''],
    ['project', 'Export project file', ''],
  ] as const) {
    cmds.push({
      id: `export-${kind}`,
      label,
      group: 'Export',
      icon: 'download',
      hint,
      run: () => void runExport(kind),
    })
  }

  for (const t of THEMES) {
    cmds.push({
      id: `theme-${t.id}`,
      label: `Theme: ${t.name}`,
      group: 'Design',
      icon: 'palette',
      hint: t.mode,
      run: () =>
        store.mutate((d) => {
          d.theme = t.id
          d.settings.accent = null
          d.settings.radius = -1
        }, { kind: 'theme' }),
    })
  }

  for (const m of slideMenu()) {
    cmds.push({
      id: `add-${m.label}`,
      label: `Insert: ${m.label}`,
      group: 'Insert',
      icon: m.icon ?? 'plus',
      run: () => {
        const at = store.slideIndex >= 0 ? store.slideIndex + 1 : undefined
        store.addSlide(newSlide(typeFromLabel(m.label ?? '')), at)
      },
    })
  }

  return cmds
}

function typeFromLabel(label: string) {
  const map: Record<string, string> = {
    Title: 'title',
    Statement: 'statement',
    'Key points': 'bullets',
    'Text + visual': 'split',
    'Metrics row': 'stats',
    'Hero number': 'stat',
    Chart: 'chart',
    Comparison: 'compare',
    Process: 'process',
    Timeline: 'timeline',
    Table: 'table',
    '2×2 matrix': 'matrix',
    Quote: 'quote',
    'Full image': 'image',
    'Section divider': 'section',
    Closing: 'closing',
  }
  return (map[label] ?? 'bullets') as Parameters<typeof newSlide>[0]
}
