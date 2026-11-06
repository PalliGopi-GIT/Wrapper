import { z } from 'zod'

export const slideSchema = z
  .record(z.string(), z.unknown())
  .refine((s) => typeof s.id === 'string' && typeof s.type === 'string', {
    message: 'each slide needs an id and a type',
  })

export const deckPayload = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(400).optional(),
  theme: z.string().max(40).optional(),
  archetype: z.string().max(40).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  slides: z.array(slideSchema).max(200).optional(),
})

export const deckUpdate = deckPayload.extend({
  revision: z.number().int().positive().optional(),
})

export const sharePayload = z.object({
  name: z.string().max(120).optional(),
  access: z.enum(['signed_in', 'invite_only']).optional(),
  allowedDomains: z.array(z.string().max(180)).max(20).optional(),
  versionId: z.string().uuid().nullable().optional(),
  allowDownload: z.boolean().optional(),
  showNotes: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  invites: z.array(z.string().email()).max(200).optional(),
})

export const sharePatch = z.object({
  name: z.string().max(120).nullable().optional(),
  access: z.enum(['signed_in', 'invite_only']).optional(),
  allowedDomains: z.array(z.string().max(180)).max(20).optional(),
  versionId: z.string().uuid().nullable().optional(),
  allowDownload: z.boolean().optional(),
  showNotes: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  revoked: z.boolean().optional(),
  invites: z.array(z.string().email()).max(200).optional(),
})

export const genRequest = z.object({
  topic: z.string().min(1).max(20_000),
  archetype: z.string().max(40).default('pitch'),
  theme: z.string().max(40).default('obsidian'),
  count: z.number().int().min(3).max(20).default(10),
  tone: z.string().max(200).default(''),
  audience: z.string().max(200).default(''),
  language: z.string().max(60).default('English'),
  notes: z.string().max(4000).default(''),
  mustInclude: z.string().max(2000).default(''),
})

export const moveRequest = z.object({
  sessionId: z.string().uuid().optional(),
  slideId: z.string().max(80).optional(),
  ms: z.number().int().min(0).max(3_600_000).optional(),
  maxSlide: z.number().int().min(0).max(500).optional(),
})

export function hasDataImage(slides: unknown[]): boolean {
  return slides.some((s) => {
    const image = (s as { image?: { src?: unknown } }).image
    return typeof image?.src === 'string' && image.src.startsWith('data:')
  })
}
