import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import handler from '../api/[...route]'

// Exercise the deployed entry point, without calling paid or configured services.
for (const key of ['CLERK_SECRET_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'DATABASE_URL', 'AI_GATEWAY_API_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) delete process.env[key]
assert.deepEqual(readdirSync('api'), ['[...route].ts'])
const health = await handler.fetch(new Request('https://example.com/api/health'))
assert.equal(health.status, 200)
const status = await health.json()
assert.equal(status.ok, true)
assert.equal(status.db, false)
assert.equal(status.ai, false)
assert.equal(status.storage, false)
const missing = await handler.fetch(new Request('https://example.com/api/not-a-route'))
assert.equal(missing.status, 404)
assert.match(missing.headers.get('content-type') || '', /application\/json/)
const decks = await handler.fetch(new Request('https://example.com/api/decks'))
assert.equal(decks.status, 503)
console.log('PASS: single function, Node fetch handler, key-free health, JSON 404, unconfigured services return 503')
