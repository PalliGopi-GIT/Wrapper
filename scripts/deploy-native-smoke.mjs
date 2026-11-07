import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// tsx resolves extensionless imports that plain Node cannot. Compile first so
// this check exercises the same ESM resolution used by the deployed function.
process.chdir(fileURLToPath(new URL('../', import.meta.url)))
const compile = spawnSync(process.execPath, [
  'node_modules/typescript/bin/tsc', '--noEmit', 'false',
  '--outDir', '.vercel/native-smoke',
], { stdio: 'inherit' })
if (compile.status !== 0) process.exit(compile.status || 1)

for (const key of ['CLERK_SECRET_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'DATABASE_URL', 'AI_GATEWAY_API_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) delete process.env[key]
const { default: handler } = await import('../.vercel/native-smoke/api/[...route].js')
const health = await handler.fetch(new Request('https://example.com/api/health'))
assert.equal(health.status, 200)
assert.equal((await health.json()).ok, true)
const missing = await handler.fetch(new Request('https://example.com/api/not-a-route'))
assert.equal(missing.status, 404)
assert.match(missing.headers.get('content-type') || '', /application\/json/)
const decks = await handler.fetch(new Request('https://example.com/api/decks'))
assert.equal(decks.status, 503)
console.log('PASS: compiled API loads in plain Node; health 200, JSON 404, missing account configuration 503')
