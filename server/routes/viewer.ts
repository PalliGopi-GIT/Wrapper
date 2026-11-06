import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { z } from 'zod'
import { requireUser, type AppEnv } from '../_lib/auth'
import { canAccessShare, hasGrant, resolveShare, upsertGrant } from '../_lib/access'
import { db } from '../_lib/db'
import { HttpError } from '../_lib/http'
import { moveRequest } from '../_lib/schemas'
import { readJson } from '../_lib/validate'
import { deckVersions, shareViewSessions, users } from '../../db/schema'
import type { Deck, Slide } from '../../src/model/types'

const routes = new Hono<AppEnv>()

routes.get('/:token/gate', async (c) => {
  const { share, deck } = await resolveShare(c.req.param('token')!)
  const [owner] = await db()
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, deck.ownerId))
    .limit(1)

  return c.json({
    ownerName: owner?.name || owner?.email?.split('@')[0] || 'Someone',
    brand: deck.settings?.brand || '',
    requiresInvite: share.access === 'invite_only',
  })
})

routes.get('/:token', requireUser, async (c) => {
  const { share, deck } = await resolveShare(c.req.param('token')!)
  const user = c.get('user')

  if (!(await canAccessShare(share, deck, user))) {
    throw new HttpError(403, 'Ask the owner for access to this deck.')
  }

  if (deck.ownerId !== user.id) await upsertGrant(share.id, user.id)

  let payload: Deck = {
    id: deck.id,
    title: deck.title,
    subtitle: deck.subtitle,
    theme: deck.theme,
    archetype: deck.archetype,
    slides: deck.slides,
    settings: deck.settings,
    createdAt: deck.createdAt.getTime(),
    updatedAt: deck.updatedAt.getTime(),
  }

  if (share.versionId) {
    const [version] = await db()
      .select()
      .from(deckVersions)
      .where(and(eq(deckVersions.id, share.versionId), eq(deckVersions.deckId, deck.id)))
      .limit(1)
    if (!version) throw new HttpError(404, 'This version is no longer available')
    payload = version.snapshot as Deck
  }

  if (!share.showNotes) {
    payload = {
      ...payload,
      slides: payload.slides.map((slide) => {
        const { notes: _notes, ...rest } = slide as Slide & { notes?: string }
        return rest as Slide
      }),
    }
  }

  return c.json({
    deck: payload,
    share: {
      name: share.name,
      access: share.access,
      allowDownload: share.allowDownload,
      showNotes: share.showNotes,
    },
  })
})

routes.post('/:token/events', requireUser, async (c) => {
  const { share, deck } = await resolveShare(c.req.param('token')!)
  const user = c.get('user')
  if (deck.ownerId !== user.id && !(await hasGrant(share.id, user.id))) {
    throw new HttpError(403, 'No access to this share')
  }

  const emptyMove: z.infer<typeof moveRequest> = {}
  const body = await readJson(c, moveRequest).catch(() => emptyMove)

  if (body.sessionId) {
    const [existing] = await db()
      .select()
      .from(shareViewSessions)
      .where(
        and(
          eq(shareViewSessions.id, body.sessionId),
          eq(shareViewSessions.userId, user.id),
          eq(shareViewSessions.shareId, share.id)
        )
      )
      .limit(1)

    if (existing) {
      const slideMs = { ...existing.slideMs }
      if (body.slideId && body.ms !== undefined) {
        slideMs[body.slideId] = (slideMs[body.slideId] ?? 0) + body.ms
      }
      const [updated] = await db()
        .update(shareViewSessions)
        .set({
          lastPingAt: sql`now()`,
          slideMs,
          maxSlide: Math.max(existing.maxSlide, body.maxSlide ?? 0),
        })
        .where(eq(shareViewSessions.id, existing.id))
        .returning()
      return c.json({ session: updated })
    }
  }

  const [session] = await db()
    .insert(shareViewSessions)
    .values({
      shareId: share.id,
      userId: user.id,
      slideMs: body.slideId && body.ms !== undefined ? { [body.slideId]: body.ms } : {},
      maxSlide: body.maxSlide ?? 0,
      userAgent: c.req.header('user-agent') ?? null,
      country: c.req.header('x-vercel-ip-country') ?? null,
    })
    .returning()

  return c.json({ session }, 201)
})

export default routes
