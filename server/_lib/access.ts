import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import {
  deckVersions,
  decks,
  shareAccessGrants,
  shareInvites,
  shareLinks,
  users,
  type AssetRow,
  type DeckRow,
  type ShareLinkRow,
  type UserRow,
} from '../../db/schema.js'
import { db } from './db.js'
import { HttpError } from './http.js'

export async function ownedDeck(userId: string, deckId: string): Promise<DeckRow> {
  if (!isUuid(deckId)) throw new HttpError(404, 'Deck not found')
  const [row] = await db()
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, userId), isNull(decks.deletedAt)))
    .limit(1)
  if (!row) throw new HttpError(404, 'Deck not found')
  return row
}

export interface ResolvedShare {
  share: ShareLinkRow
  deck: DeckRow
}

export async function resolveShare(token: string): Promise<ResolvedShare> {
  const [row] = await db()
    .select({ share: shareLinks, deck: decks })
    .from(shareLinks)
    .innerJoin(decks, eq(shareLinks.deckId, decks.id))
    .where(eq(shareLinks.token, token))
    .limit(1)

  if (!row) throw new HttpError(404, 'This link is no longer active')
  if (row.share.revokedAt) throw new HttpError(404, 'This link is no longer active')
  if (row.share.expiresAt && row.share.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(404, 'This link has expired')
  }
  if (row.deck.deletedAt) throw new HttpError(404, 'This deck is no longer available')

  return row
}

export async function canAccessShare(share: ShareLinkRow, deck: DeckRow, user: UserRow): Promise<boolean> {
  if (deck.ownerId === user.id) return true
  if (share.access === 'signed_in') return true

  const domain = user.email.split('@')[1]?.toLowerCase()
  if (domain && share.allowedDomains.some((d) => d.toLowerCase() === domain)) return true

  const [invite] = await db()
    .select()
    .from(shareInvites)
    .where(and(eq(shareInvites.shareId, share.id), eq(shareInvites.email, user.email)))
    .limit(1)

  return Boolean(invite)
}

export async function upsertGrant(shareId: string, userId: string) {
  await db()
    .insert(shareAccessGrants)
    .values({ shareId, userId })
    .onConflictDoUpdate({
      target: [shareAccessGrants.shareId, shareAccessGrants.userId],
      set: {
        lastViewedAt: sql`now()`,
        viewCount: sql`${shareAccessGrants.viewCount} + 1`,
      },
    })
}

export async function hasGrant(shareId: string, userId: string): Promise<boolean> {
  const [row] = await db()
    .select()
    .from(shareAccessGrants)
    .where(and(eq(shareAccessGrants.shareId, shareId), eq(shareAccessGrants.userId, userId)))
    .limit(1)
  return Boolean(row)
}

export async function canViewAsset(user: UserRow, asset: AssetRow): Promise<boolean> {
  if (asset.ownerId === user.id) return true
  if (!asset.deckId) return false

  const [row] = await db()
    .select({ id: shareLinks.id })
    .from(shareLinks)
    .innerJoin(
      shareAccessGrants,
      and(
        eq(shareAccessGrants.shareId, shareLinks.id),
        eq(shareAccessGrants.userId, user.id)
      )
    )
    .where(
      and(
        eq(shareLinks.deckId, asset.deckId),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date()))
      )
    )
    .limit(1)

  return Boolean(row)
}

export async function deckOwnerEmail(userId: string): Promise<string | undefined> {
  const [row] = await db().select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.email
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function nextDeckVersion(deckId: string): Promise<number> {
  const [row] = await db()
    .select({ max: sql<number>`coalesce(max(${deckVersions.version}), 0)` })
    .from(deckVersions)
    .where(eq(deckVersions.deckId, deckId))
  return Number(row?.max ?? 0) + 1
}
