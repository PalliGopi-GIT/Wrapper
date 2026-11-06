import { randomBytes } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireCreator, type AppEnv } from '../_lib/auth'
import { ownedDeck } from '../_lib/access'
import { db } from '../_lib/db'
import { HttpError } from '../_lib/http'
import { sharePatch, sharePayload } from '../_lib/schemas'
import { readJson } from '../_lib/validate'
import {
  shareAccessGrants,
  shareInvites,
  shareLinks,
  shareViewSessions,
  users,
} from '../../db/schema'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function newToken(): string {
  const bytes = randomBytes(16)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

const routes = new Hono<AppEnv>()
routes.use('*', requireCreator)

async function ownedShare(userId: string, deckId: string, shareId: string) {
  const deck = await ownedDeck(userId, deckId)
  const [share] = await db()
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.id, shareId), eq(shareLinks.deckId, deck.id)))
    .limit(1)
  if (!share) throw new HttpError(404, 'Share link not found')
  return { deck, share }
}

routes.get('/:id/shares', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  const rows = await db()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.deckId, deck.id))
    .orderBy(desc(shareLinks.createdAt))

  const ids = rows.map((share) => share.id)
  const invites = ids.length
    ? await db().select().from(shareInvites).where(inArray(shareInvites.shareId, ids))
    : []

  return c.json({
    shares: rows.map((share) => ({
      ...share,
      invites: invites.filter((i) => i.shareId === share.id).map((i) => i.email),
    })),
  })
})

routes.post('/:id/shares', async (c) => {
  const deck = await ownedDeck(c.get('userId'), c.req.param('id'))
  const body = await readJson(c, sharePayload)

  const [share] = await db()
    .insert(shareLinks)
    .values({
      deckId: deck.id,
      token: newToken(),
      createdBy: c.get('userId'),
      name: body.name ?? null,
      access: body.access ?? 'signed_in',
      allowedDomains: body.allowedDomains ?? [],
      versionId: body.versionId ?? null,
      allowDownload: body.allowDownload ?? false,
      showNotes: body.showNotes ?? false,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })
    .returning()

  if (body.invites?.length) {
    await db()
      .insert(shareInvites)
      .values(body.invites.map((email) => ({ shareId: share.id, email })))
      .onConflictDoNothing()
  }

  return c.json({ share }, 201)
})

routes.patch('/:id/shares/:sid', async (c) => {
  const { share } = await ownedShare(c.get('userId'), c.req.param('id'), c.req.param('sid'))
  const body = await readJson(c, sharePatch)

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.access !== undefined) patch.access = body.access
  if (body.allowedDomains !== undefined) patch.allowedDomains = body.allowedDomains
  if (body.versionId !== undefined) patch.versionId = body.versionId
  if (body.allowDownload !== undefined) patch.allowDownload = body.allowDownload
  if (body.showNotes !== undefined) patch.showNotes = body.showNotes
  if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body.revoked !== undefined) patch.revokedAt = body.revoked ? new Date() : null

  const [updated] = await db()
    .update(shareLinks)
    .set(patch)
    .where(eq(shareLinks.id, share.id))
    .returning()

  if (body.invites?.length) {
    await db()
      .insert(shareInvites)
      .values(body.invites.map((email) => ({ shareId: share.id, email })))
      .onConflictDoNothing()
  }

  return c.json({ share: updated })
})

routes.delete('/:id/shares/:sid', async (c) => {
  const { share } = await ownedShare(c.get('userId'), c.req.param('id'), c.req.param('sid'))
  const [updated] = await db()
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.id, share.id))
    .returning()
  return c.json({ share: updated })
})

routes.get('/:id/shares/:sid/analytics', async (c) => {
  const { share } = await ownedShare(c.get('userId'), c.req.param('id'), c.req.param('sid'))

  const grants = await db()
    .select({
      userId: shareAccessGrants.userId,
      email: users.email,
      name: users.name,
      firstViewedAt: shareAccessGrants.firstViewedAt,
      lastViewedAt: shareAccessGrants.lastViewedAt,
      viewCount: shareAccessGrants.viewCount,
    })
    .from(shareAccessGrants)
    .innerJoin(users, eq(users.id, shareAccessGrants.userId))
    .where(eq(shareAccessGrants.shareId, share.id))

  const sessions = await db()
    .select()
    .from(shareViewSessions)
    .where(eq(shareViewSessions.shareId, share.id))
    .orderBy(desc(shareViewSessions.startedAt))
    .limit(200)

  return c.json({ grants, sessions })
})

export default routes
