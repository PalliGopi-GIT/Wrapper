import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { decks, users } from '../db/schema'

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, value] = match
      if (process.env[key] === undefined) process.env[key] = value.replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* file not present */
  }
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL')

const db = drizzle(neon(url))
const userId = 'user_smoke_test'

await db
  .insert(users)
  .values({ id: userId, email: 'smoke@example.com', name: 'Smoke Test', kind: 'creator' })
  .onConflictDoUpdate({ target: users.id, set: { email: 'smoke@example.com' } })

const [deck] = await db
  .insert(decks)
  .values({ ownerId: userId, title: 'Smoke deck', slides: [] })
  .returning()

const [found] = await db.select().from(decks).where(eq(decks.id, deck.id))
if (!found || found.title !== 'Smoke deck') throw new Error('Deck round-trip failed')

console.log(
  JSON.stringify({
    ok: true,
    deckId: found.id,
    title: found.title,
    slideCount: found.slideCount,
    revision: found.revision,
  })
)

await db.delete(decks).where(eq(decks.ownerId, userId))
await db.delete(users).where(eq(users.id, userId))
