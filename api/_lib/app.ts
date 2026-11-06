import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { AppEnv } from './auth'
import { appOrigins, handleError } from './http'
import aiRoutes from '../routes/ai'
import assetRoutes from '../routes/assets'
import cronRoutes from '../routes/cron'
import deckRoutes from '../routes/decks'
import exportRoutes from '../routes/exports'
import meRoutes from '../routes/me'
import shareRoutes from '../routes/shares'
import versionRoutes from '../routes/versions'
import viewerRoutes from '../routes/viewer'
import webhookRoutes from '../routes/webhooks'

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
