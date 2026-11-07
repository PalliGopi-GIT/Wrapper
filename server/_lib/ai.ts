import type { AIConfig } from '../../src/model/types.js'
import {
  addSlide,
  editDeck,
  generateDeck,
  outlineDeck,
  reviseSlide,
} from '../../src/ai/generate.js'
import { HttpError, requireEnv } from './http.js'

export const ALLOWED_MODELS = [
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'google/gemini-3-flash',
  'google/gemini-2.5-flash',
] as const

export type AllowedModel = (typeof ALLOWED_MODELS)[number]

export function gatewayConfig(model?: string): AIConfig {
  const chosen = ALLOWED_MODELS.includes(model as AllowedModel)
    ? (model as AllowedModel)
    : ALLOWED_MODELS[0]

  return {
    provider: 'vercel',
    model: chosen,
    key: requireEnv('AI_GATEWAY_API_KEY'),
    baseUrl: process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1',
  }
}

export function assertAllowedModel(model: string | undefined): void {
  if (model && !ALLOWED_MODELS.includes(model as AllowedModel)) {
    throw new HttpError(422, `Model not allowed: ${model}`)
  }
}

export { addSlide, editDeck, generateDeck, outlineDeck, reviseSlide }
