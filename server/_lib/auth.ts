import { createClerkClient, type ClerkClient } from '@clerk/backend'
import { eq, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { users, type UserRow } from '../../db/schema.js'
import { db } from './db.js'
import { HttpError, appOrigins } from './http.js'

export type Role = 'creator' | 'viewer'

export type AppEnv = {
  Variables: {
    userId: string
    role: Role
    user: UserRow
  }
}

let client: ClerkClient | null = null

export function clerk(): ClerkClient {
  if (!client) {
    client = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    })
  }
  return client
}

function roleFromMetadata(info: {
  publicMetadata?: Record<string, unknown>
  unsafeMetadata?: Record<string, unknown>
}): Role {
  const publicRole = info.publicMetadata?.role
  if (publicRole === 'creator' || publicRole === 'viewer') return publicRole
  return info.unsafeMetadata?.source === 'share' ? 'viewer' : 'creator'
}

async function ensureUser(userId: string): Promise<UserRow> {
  const existing = await db()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const row = existing[0]
  if (row && !row.deletedAt) return row

  const info = await clerk().users.getUser(userId)
  const email =
    info.primaryEmailAddress?.emailAddress ??
    info.emailAddresses[0]?.emailAddress ??
    `${userId}@users.noreply.clerk`
  const name = [info.firstName, info.lastName].filter(Boolean).join(' ') || info.username || null
  const kind = roleFromMetadata(info)

  const [upserted] = await db()
    .insert(users)
    .values({
      id: userId,
      email,
      name,
      imageUrl: info.imageUrl || null,
      kind,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name,
        imageUrl: info.imageUrl || null,
        kind,
        updatedAt: sql`now()`,
        deletedAt: null,
      },
    })
    .returning()

  return upserted
}

export async function requireUser(c: Context<AppEnv>, next: () => Promise<void>) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.VITE_CLERK_PUBLISHABLE_KEY || !process.env.DATABASE_URL) {
    throw new HttpError(503, 'Account services are not configured yet')
  }
  const state = await clerk().authenticateRequest(c.req.raw, {
    authorizedParties: appOrigins(),
  })

  if (!state.isAuthenticated || !state.toAuth()?.userId) {
    throw new HttpError(401, 'Sign in required')
  }

  const userId = state.toAuth().userId as string
  const user = await ensureUser(userId)

  c.set('userId', userId)
  c.set('role', user.kind as Role)
  c.set('user', user)

  await next()
}

export async function requireCreator(c: Context<AppEnv>, next: () => Promise<void>) {
  await requireUser(c, async () => {
    if (c.get('role') !== 'creator') {
      throw new HttpError(403, 'Only creators can do that. Upgrade your account first.')
    }
    await next()
  })
}
