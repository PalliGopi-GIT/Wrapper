import type { Deck } from '../model/types'
import { defaultSettings } from '../model/types'
import { downloadBlob, safeName } from './common'

export function saveProject(deck: Deck) {
  downloadBlob(
    new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }),
    `${safeName(deck.title)}.cadence.json`
  )
}

export async function loadProject(file: File): Promise<Deck> {
  const text = await file.text()
  const raw = JSON.parse(text) as Partial<Deck>
  if (!raw || !Array.isArray(raw.slides)) throw new Error('That file is not a Cadence deck.')
  return {
    id: raw.id ?? crypto.randomUUID(),
    title: raw.title ?? 'Imported deck',
    subtitle: raw.subtitle ?? '',
    theme: raw.theme ?? 'obsidian',
    archetype: raw.archetype ?? 'pitch',
    slides: raw.slides,
    settings: { ...defaultSettings(), ...(raw.settings ?? {}) },
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
}
