import type { AIConfig } from '../model/types'
import { DEFAULT_CONFIG } from './client'

const KEY = 'cadence.ai.v1'

export function loadAI(): AIConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<AIConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveAI(cfg: AIConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg))
  } catch {
    /* ignore */
  }
}

export function hasAI(): boolean {
  const cfg = loadAI()
  return cfg.provider === 'custom' ? Boolean(cfg.baseUrl) : Boolean(cfg.key)
}
