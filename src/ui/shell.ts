import { store } from '../store'
import { mountTopbar, renderTopbar } from './topbar'
import { mountRail, renderRail, updateRailSelection } from './rail'
import { mountCanvas, renderCanvas, refreshScale } from './canvas'
import { mountInspector, renderInspector } from './inspector'

export function buildShell() {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app')
  app.innerHTML = `
    <div class="app">
      <header class="topbar"></header>
      <div class="workspace">
        <aside class="rail"></aside>
        <main class="canvas"></main>
        <aside class="inspector"></aside>
      </div>
    </div>`

  mountTopbar(document.querySelector('.topbar') as HTMLElement)
  mountRail(document.querySelector('.rail') as HTMLElement)
  mountCanvas(document.querySelector('.canvas') as HTMLElement)
  mountInspector(document.querySelector('.inspector') as HTMLElement)

  syncLayout()
  renderTopbar()
  renderRail()
  renderCanvas()
  renderInspector()
}

export function syncLayout() {
  const ws = document.querySelector('.workspace')
  if (!ws) return
  ws.classList.toggle('rail-hidden', !store.ui.railOpen)
  ws.classList.toggle('insp-hidden', !store.ui.inspectorOpen)
  ws.classList.toggle('focus', store.ui.focus)
  requestAnimationFrame(() => refreshScale())
}

export function renderAll() {
  syncLayout()
  renderTopbar()
  renderRail()
  renderCanvas()
  renderInspector()
}

export function renderSelection() {
  updateRailSelection()
  renderTopbar()
  renderCanvas()
  renderInspector()
}
