import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { Webhook } from 'svix'
import { db } from '../_lib/db.js'
import { HttpError, requireEnv } from '../_lib/http.js'
import { decks, users, webhookEvents } from '../../db/schema.js'

interface ClerkUserData {
  id: string
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  image_url?: string | null
  primary_email_address_id?: string | null
  email_addresses?: { id: string; email_address: string }[]
  public_metadata?: { role?: string } | null
  unsafe_metadata?: { source?: string } | null
}

function emailFor(data: ClerkUserData): string {
  const primary = data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
  return primary?.email_address ?? data.email_addresses?.[0]?.email_address ?? `${data.id}@users.noreply.clerk`
}

function roleFor(data: ClerkUserData): 'creator' | 'viewer' {
  const role = data.public_metadata?.role
  if (role === 'creator' || role === 'viewer') return role
  return data.unsafe_metadata?.source === 'share' ? 'viewer' : 'creator'
}

const routes = new Hono()

routes.post('/clerk', async (c) => {
  const id = c.req.header('svix-id')
  const timestamp = c.req.header('svix-timestamp')
  const signature = c.req.header('svix-signature')

  if (!id || !timestamp || !signature) throw new HttpError(400, 'Missing Svix headers')

  const payload = await c.req.text()
  let event: { type: string; data: ClerkUserData }
  try {
    const wh = new Webhook(requireEnv('CLERK_WEBHOOK_SIGNING_SECRET'))
    event = wh.verify(payload, {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }) as unknown as { type: string; data: ClerkUserData }
  } catch {
    throw new HttpError(400, 'Invalid webhook signature')
  }

  const inserted = await db()
    .insert(webhookEvents)
    .values({ id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id })

  if (!inserted.length) return c.json({ ok: true, duplicate: true })

  const data = event.data
  const email = emailFor(data)
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || null

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      await db()
        .insert(users)
        .values({
          id: data.id,
          email,
          name,
          imageUrl: data.image_url ?? null,
          kind: roleFor(data),
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email,
            name,
            imageUrl: data.image_url ?? null,
            kind: roleFor(data),
            updatedAt: sql`now()`,
            deletedAt: null,
          },
        })
      break
    }
    case 'user.deleted': {
      await db().update(users).set({ deletedAt: sql`now()` }).where(eq(users.id, data.id))
      await db().update(decks).set({ deletedAt: sql`now()` }).where(eq(decks.ownerId, data.id))
      break
    }
    default:
      break
  }

  return c.json({ ok: true })
})

export default routes
