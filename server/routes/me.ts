import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { clerk, requireUser, type AppEnv } from '../_lib/auth.js'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'

const routes = new Hono<AppEnv>()

routes.get('/me', requireUser, (c) => {
  return c.json({ user: c.get('user'), role: c.get('role') })
})

routes.post('/me/upgrade', requireUser, async (c) => {
  const userId = c.get('userId')
  await clerk().users.updateUserMetadata(userId, {
    publicMetadata: { role: 'creator' },
  })
  const [user] = await db()
    .update(users)
    .set({ kind: 'creator', updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning()
  c.set('role', 'creator')
  c.set('user', user)
  return c.json({ user, role: 'creator' })
})

export default routes
