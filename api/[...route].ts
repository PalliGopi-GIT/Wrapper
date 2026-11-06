import { handle } from '@hono/vercel'
import { app } from './_lib/app'

export const config = { runtime: 'nodejs' }

export default handle(app)
