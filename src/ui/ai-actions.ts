import { store } from '../store'
import type { Slide } from '../model/types'
import { api } from '../app/api'
import { toast } from './dom'

export function requireAI(): boolean {
  return true
}

async function busy<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  store.ui.generating = true
  store.ui.generatingLabel = label
  store.emit('generate')
  try {
    return await fn()
  } catch (e) {
    toast((e as Error).message || 'Something went wrong.', 'err', 5000)
    return null
  } finally {
    store.ui.generating = false
    store.emit('generate')
  }
}

export async function rewriteSlide(slideId: string, instruction: string) {
  const slide = store.deck.slides.find((s) => s.id === slideId)
  if (!slide) return
  const index = store.deck.slides.findIndex((s) => s.id === slideId)

  const result = await busy('Rewriting slide', async () => {
    const response = await api<{ slide: Slide }>('/ai/rewrite-slide', {
      method: 'POST',
      body: JSON.stringify({
        slide,
        instruction,
        deckTitle: store.deck.title,
        position: `${index + 1} of ${store.deck.slides.length}`,
        theme: store.deck.theme,
        deckId: store.deck.id,
      }),
    })
    return response.slide
  })

  if (!result) return
  store.mutate((d) => {
    const i = d.slides.findIndex((s) => s.id === slideId)
    if (i >= 0) d.slides[i] = { ...result, id: slideId }
  })
  toast('Slide rewritten')
}

export async function addSlideWithAI(instruction: string) {
  const result = await busy('Composing slide', async () => {
    const response = await api<{ slide: Slide }>('/ai/add-slide', {
      method: 'POST',
      body: JSON.stringify({ deck: store.deck, instruction }),
    })
    return response.slide
  })

  if (!result) return
  const at = Math.max(0, store.slideIndex + 1)
  store.addSlide(result, at)
  toast('Slide added')
}

export async function deckOperation(instruction: string, label = 'Editing deck') {
  const result = await busy(label, () =>
    api<{ title: string; subtitle: string; slides: Slide[] }>('/ai/deck-op', {
      method: 'POST',
      body: JSON.stringify({ deck: store.deck, instruction }),
    })
  )

  if (!result) return
  store.mutate((d) => {
    d.title = result.title
    d.subtitle = result.subtitle
    d.slides = result.slides
  })
  store.ui.selectedId = result.slides[0]?.id ?? null
  store.emit('selection')
  toast('Deck updated')
}
