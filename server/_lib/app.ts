import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { AppEnv } from './auth.js'
import { appOrigins, handleError } from './http.js'
import aiRoutes from '../routes/ai.js'
import assetRoutes from '../routes/assets.js'
import cronRoutes from '../routes/cron.js'
import deckRoutes from '../routes/decks.js'
import exportRoutes from '../routes/exports.js'
import meRoutes from '../routes/me.js'
import shareRoutes from '../routes/shares.js'
import versionRoutes from '../routes/versions.js'
import viewerRoutes from '../routes/viewer.js'
import webhookRoutes from '../routes/webhooks.js'

const app = new Hono<AppEnv>().basePath('/api')

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: [...new Set([...appOrigins(), 'http://localhost:5173'])],
    credentials: true,
    allowHeaders: ['content-type', 'if-match', 'authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'cadence-api',
    time: new Date().toISOString(),
    ai: Boolean(process.env.AI_GATEWAY_API_KEY),
    db: Boolean(process.env.DATABASE_URL),
    storage: Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
  })
)

app.route('/', meRoutes)
app.route('/decks', deckRoutes)
app.route('/decks', versionRoutes)
app.route('/decks', shareRoutes)
app.route('/share', viewerRoutes)
app.route('/assets', assetRoutes)
app.route('/exports', exportRoutes)
app.route('/ai', aiRoutes)
app.route('/webhooks', webhookRoutes)
app.route('/cron', cronRoutes)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError(handleError)

export { app }
