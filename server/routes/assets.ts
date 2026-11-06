import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { canViewAsset, ownedDeck } from '../_lib/access'
import { requireCreator, requireUser, type AppEnv } from '../_lib/auth'
import { db } from '../_lib/db'
import { HttpError } from '../_lib/http'
import { headObject, presignGet, presignPut } from '../_lib/r2'
import { readJson } from '../_lib/validate'
import { assets } from '../../db/schema'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

const createAsset = z.object({
  deckId: z.string().uuid().optional(),
  contentType: z.string().regex(/^image\//, 'only images are allowed'),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

const routes = new Hono<AppEnv>()

routes.post('/', requireCreator, async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c, createAsset)

  if (body.deckId) await ownedDeck(userId, body.deckId)

  const id = randomUUID()
  const ext = EXT[body.contentType] ?? 'bin'
  const objectKey = `u/${userId}/a/${id}.${ext}`

  const [asset] = await db()
    .insert(assets)
    .values({
      id,
      ownerId: userId,
      deckId: body.deckId ?? null,
      objectKey,
      contentType: body.contentType,
      byteSize: body.size,
      width: body.width ?? null,
      height: body.height ?? null,
      status: 'pending',
    })
    .returning()

  const uploadUrl = await presignPut(objectKey, body.contentType, body.size)
  return c.json({ assetId: asset.id, uploadUrl, key: objectKey }, 201)
})

routes.post('/:id/complete', requireCreator, async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')!
  const [asset] = await db()
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, userId)))
    .limit(1)

  if (!asset) throw new HttpError(404, 'Asset not found')

  const head = await headObject(asset.objectKey)
  if (!head) throw new HttpError(404, 'Upload not found in storage')

  const [updated] = await db()
    .update(assets)
    .set({
      status: 'ready',
      byteSize: head.size ?? asset.byteSize,
      contentType: head.type ?? asset.contentType,
    })
    .where(eq(assets.id, asset.id))
    .returning()

  return c.json({ asset: updated, src: `/api/assets/${asset.id}` })
})

routes.get('/:id', requireUser, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')!
  const [asset] = await db()
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.status, 'ready')))
    .limit(1)

  if (!asset) throw new HttpError(404, 'Asset not found')
  if (!(await canViewAsset(user, asset))) throw new HttpError(403, 'No access to this asset')

  const url = await presignGet(asset.objectKey)
  c.header('Cache-Control', 'private, max-age=300')
  return c.redirect(url, 302)
})

export default routes
