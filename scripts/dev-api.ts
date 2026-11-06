import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'

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

const { app } = await import('../api/_lib/app')
const port = Number(process.env.API_PORT || 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Cadence API on http://localhost:${info.port}/api`)
})
