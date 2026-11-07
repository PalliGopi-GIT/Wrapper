import { app } from '../server/_lib/app.js'

// Vercel's Web Standard Node.js handler.
export default { fetch: app.fetch }
