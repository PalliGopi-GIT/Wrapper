import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    let raw: string
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, value] = match
      if (process.env[key] !== undefined) continue
      process.env[key] = value.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadEnv()

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!url) {
  throw new Error('Missing DATABASE_URL_UNPOOLED or DATABASE_URL')
}

const db = drizzle(neon(url))
await migrate(db, { migrationsFolder: './db/migrations' })
console.log('Migrations applied')
