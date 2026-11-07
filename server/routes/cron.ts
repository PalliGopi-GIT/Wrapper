import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../_lib/db.js'
import { HttpError, requireEnv } from '../_lib/http.js'
import { deleteObject } from '../_lib/r2.js'
import { assets, deckExports, decks } from '../../db/schema.js'

const routes = new Hono()

routes.get('/gc', async (c) => {
  const expected = `Bearer ${requireEnv('CRON_SECRET')}`
  if (c.req.header('authorization') !== expected) throw new HttpError(401, 'Unauthorized')

  const pending = await db()
    .select()
    .from(assets)
    .where(and(eq(assets.status, 'pending'), sql`created_at < now() - interval '24 hours'`))

  let removed = 0
  for (const asset of pending) {
    try {
      await deleteObject(asset.objectKey)
    } catch {
      /* object may already be gone */
    }
    await db().delete(assets).where(eq(assets.id, asset.id))
    removed++
  }

  const staleExports = await db()
    .select()
    .from(deckExports)
    .where(sql`created_at < now() - interval '7 days'`)

  let exportsRemoved = 0
  for (const row of staleExports) {
    try {
      await deleteObject(row.objectKey)
    } catch {
      /* object may already be gone */
    }
    await db().delete(deckExports).where(eq(deckExports.id, row.id))
    exportsRemoved++
  }

  const purged = await db()
    .delete(decks)
    .where(sql`deleted_at is not null and deleted_at < now() - interval '30 days'`)
    .returning({ id: decks.id })

  return c.json({
    ok: true,
    pendingAssetsRemoved: removed,
    exportsRemoved,
    decksPurged: purged.length,
  })
})

export default routes
