import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  addSlide,
  assertAllowedModel,
  editDeck,
  gatewayConfig,
  generateDeck,
  outlineDeck,
  reviseSlide,
} from '../_lib/ai'
import { requireCreator, type AppEnv } from '../_lib/auth'
import { db } from '../_lib/db'
import { HttpError } from '../_lib/http'
import { genRequest } from '../_lib/schemas'
import { readJson } from '../_lib/validate'
import { aiUsage } from '../../db/schema'
import type { Deck, Slide } from '../../src/model/types'

const routes = new Hono<AppEnv>()
routes.use('*', requireCreator)

const HOUR_LIMIT = 30
const DAY_LIMIT = 200

async function assertQuota(userId: string) {
  const [hour] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), sql`created_at > now() - interval '1 hour'`))
  if (Number(hour?.n ?? 0) >= HOUR_LIMIT) {
    throw new HttpError(429, 'AI limit reached for this hour. Try again later.')
  }

  const [day] = await db()
    .select({ n: sql<number>`count(*)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), sql`created_at > now() - interval '1 day'`))
  if (Number(day?.n ?? 0) >= DAY_LIMIT) {
    throw new HttpError(429, 'Daily AI limit reached.')
  }
}

async function logUsage(
  userId: string,
  operation: string,
  model: string,
  ok: boolean,
  deckId?: string
) {
  await db()
    .insert(aiUsage)
    .values({ userId, operation, model, ok, deckId: deckId ?? null })
    .catch((err) => console.error('Failed to record AI usage', err))
}

const withModel = genRequest.extend({
  model: z.string().max(80).optional(),
  deckId: z.string().uuid().optional(),
})

routes.post('/compose', async (c) => {
  const userId = c.get('userId')
  const { model, deckId, ...request } = await readJson(c, withModel)
  assertAllowedModel(model)
  await assertQuota(userId)

  try {
    const result = await generateDeck(gatewayConfig(model), request)
    await logUsage(userId, 'compose', gatewayConfig(model).model, true, deckId)
    return c.json(result)
  } catch (err) {
    await logUsage(userId, 'compose', gatewayConfig(model).model, false, deckId)
    throw err
  }
})

routes.post('/outline', async (c) => {
  const userId = c.get('userId')
  const { model, deckId, ...request } = await readJson(c, withModel)
  assertAllowedModel(model)
  await assertQuota(userId)

  try {
    const spine = await outlineDeck(gatewayConfig(model), request)
    await logUsage(userId, 'outline', gatewayConfig(model).model, true, deckId)
    return c.json({ spine })
  } catch (err) {
    await logUsage(userId, 'outline', gatewayConfig(model).model, false, deckId)
    throw err
  }
})

const rewriteBody = z.object({
  slide: z.record(z.string(), z.unknown()),
  instruction: z.string().max(4000).default(''),
  deckTitle: z.string().max(200).default(''),
  position: z.string().max(40).default(''),
  theme: z.string().max(40).default('obsidian'),
  model: z.string().max(80).optional(),
  deckId: z.string().uuid().optional(),
})

routes.post('/rewrite-slide', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c, rewriteBody)
  assertAllowedModel(body.model)
  await assertQuota(userId)

  try {
    const slide = await reviseSlide(gatewayConfig(body.model), {
      slide: body.slide as unknown as Slide,
      instruction: body.instruction,
      deckTitle: body.deckTitle,
      position: body.position,
      theme: body.theme,
    })
    await logUsage(userId, 'rewrite_slide', gatewayConfig(body.model).model, true, body.deckId)
    return c.json({ slide })
  } catch (err) {
    await logUsage(userId, 'rewrite_slide', gatewayConfig(body.model).model, false, body.deckId)
    throw err
  }
})

const slideBody = z.object({
  deck: z.record(z.string(), z.unknown()),
  instruction: z.string().min(1).max(4000),
  model: z.string().max(80).optional(),
})

routes.post('/add-slide', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c, slideBody)
  assertAllowedModel(body.model)
  await assertQuota(userId)

  try {
    const slide = await addSlide(gatewayConfig(body.model), body.deck as unknown as Deck, body.instruction)
    await logUsage(userId, 'add_slide', gatewayConfig(body.model).model, true)
    return c.json({ slide })
  } catch (err) {
    await logUsage(userId, 'add_slide', gatewayConfig(body.model).model, false)
    throw err
  }
})

routes.post('/deck-op', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c, slideBody)
  assertAllowedModel(body.model)
  await assertQuota(userId)

  try {
    const result = await editDeck(gatewayConfig(body.model), body.deck as unknown as Deck, body.instruction)
    await logUsage(userId, 'deck_op', gatewayConfig(body.model).model, true)
    return c.json(result)
  } catch (err) {
    await logUsage(userId, 'deck_op', gatewayConfig(body.model).model, false)
    throw err
  }
})

export default routes
