import { app } from '../server/_lib/app'

// Vercel's Web Standard Node.js handler.
export default { fetch: app.fetch }
