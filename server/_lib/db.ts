import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from '../../db/schema'
import { requireEnv } from './http'

let client: NeonHttpDatabase<typeof schema> | null = null

export function db(): NeonHttpDatabase<typeof schema> {
  if (!client) {
    client = drizzle(neon(requireEnv('DATABASE_URL')), { schema })
  }
  return client
}
