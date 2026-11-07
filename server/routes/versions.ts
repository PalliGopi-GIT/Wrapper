import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { requireCreator, type AppEnv } from '../_lib/auth.js'
import { nextDeckVersion, ownedDeck } from '../_lib/access.js'
import { db } from '../_lib/db.js'
import { readJson } from '../_lib/validate.js'
import { deckVersions } from '../../db/schema.js'
import { z } from 'zod'

const routes = new Hono<AppEnv>()
routes.use('*', requireCreator)

const versionPayload = z.object({ label: z.string().max(120).optional() })

routes.get('/:id/versions', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  const rows = await db()
    .select()
    .from(deckVersions)
    .where(eq(deckVersions.deckId, deck.id))
    .orderBy(desc(deckVersions.version))
  return c.json({ versions: rows })
})

routes.post('/:id/versions', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  const body = await readJson(c, versionPayload).catch(() => ({ label: undefined }))
  const version = await nextDeckVersion(deck.id)

  const [row] = await db()
    .insert(deckVersions)
    .values({
      deckId: deck.id,
      version,
      label: body.label ?? null,
      snapshot: {
        id: deck.id,
        title: deck.title,
        subtitle: deck.subtitle,
        theme: deck.theme,
        archetype: deck.archetype,
        slides: deck.slides,
        settings: deck.settings,
        createdAt: deck.createdAt.getTime(),
        updatedAt: deck.updatedAt.getTime(),
      },
      createdBy: c.get('userId'),
    })
    .returning()

  return c.json({ version: row }, 201)
})

routes.get('/:id/versions/:versionId', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  const [row] = await db()
    .select()
    .from(deckVersions)
    .where(and(eq(deckVersions.deckId, deck.id), eq(deckVersions.id, c.req.param('versionId'))))
    .limit(1)
  if (!row) return c.json({ error: 'Version not found' }, 404)
  return c.json({ version: row })
})

export default routes
