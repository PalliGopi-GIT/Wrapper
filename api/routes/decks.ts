import { Hono } from 'hono'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { requireCreator, type AppEnv } from '../_lib/auth'
import { ownedDeck } from '../_lib/access'
import { db } from '../_lib/db'
import { HttpError } from '../_lib/http'
import { hasDataImage } from '../_lib/schemas'
import { readJson } from '../_lib/validate'
import { deckPayload, deckUpdate } from '../_lib/schemas'
import { decks } from '../../db/schema'
import { defaultSettings, type DeckSettings, type Slide } from '../../src/model/types'

const routes = new Hono<AppEnv>()
routes.use('*', requireCreator)

routes.get('/', async (c) => {
  const rows = await db()
    .select({
      id: decks.id,
      title: decks.title,
      subtitle: decks.subtitle,
      theme: decks.theme,
      archetype: decks.archetype,
      slideCount: decks.slideCount,
      revision: decks.revision,
      thumbnailKey: decks.thumbnailKey,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .where(and(eq(decks.ownerId, c.get('userId')), isNull(decks.deletedAt)))
    .orderBy(sql`${decks.updatedAt} desc`)
    .limit(100)

  return c.json({ decks: rows })
})

routes.post('/', async (c) => {
  const body = await readJson(c, deckPayload)
  if (body.slides && hasDataImage(body.slides)) {
    throw new HttpError(422, 'Inline data: images are not allowed. Upload the image first.')
  }

  const [deck] = await db()
    .insert(decks)
    .values({
      ownerId: c.get('userId'),
      title: body.title ?? 'Untitled deck',
      subtitle: body.subtitle ?? '',
      theme: body.theme ?? 'obsidian',
      archetype: body.archetype ?? 'pitch',
      settings: (body.settings as DeckSettings | undefined) ?? defaultSettings(),
      slides: (body.slides as Slide[] | undefined) ?? [],
    })
    .returning()

  return c.json({ deck }, 201)
})

routes.get('/:id', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  return c.json({ deck })
})

routes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const deck = await ownedDeck(userId, id)
  const body = await readJson(c, deckUpdate)

  const headerRevision = Number((c.req.header('if-match') || '').replace(/[^0-9]/g, ''))
  const expected = headerRevision || body.revision || deck.revision

  if (expected !== deck.revision) {
    throw new HttpError(409, 'This deck changed in another tab. Reload before saving.')
  }
  if (body.slides && hasDataImage(body.slides)) {
    throw new HttpError(422, 'Inline data: images are not allowed. Upload the image first.')
  }

  const patch: Record<string, unknown> = {
    revision: sql`${decks.revision} + 1`,
    updatedAt: sql`now()`,
  }
  if (body.title !== undefined) patch.title = body.title
  if (body.subtitle !== undefined) patch.subtitle = body.subtitle
  if (body.theme !== undefined) patch.theme = body.theme
  if (body.archetype !== undefined) patch.archetype = body.archetype
  if (body.settings !== undefined) patch.settings = body.settings
  if (body.slides !== undefined) patch.slides = body.slides

  const [updated] = await db()
    .update(decks)
    .set(patch)
    .where(
      and(
        eq(decks.id, id),
        eq(decks.ownerId, userId),
        eq(decks.revision, expected),
        isNull(decks.deletedAt)
      )
    )
    .returning()

  if (!updated) throw new HttpError(409, 'This deck changed in another tab. Reload before saving.')
  return c.json({ deck: updated })
})

routes.delete('/:id', async (c) => {
  await ownedDeck(c.get('userId'), c.req.param('id'))
  await db()
    .update(decks)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(decks.id, c.req.param('id')), eq(decks.ownerId, c.get('userId'))))
  return c.json({ ok: true })
})

export default routes
