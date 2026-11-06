import type { Context } from 'hono'

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 503,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new HttpError(500, `Server is missing ${name}`)
  return value
}

export function appOrigins(): string[] {
  return (process.env.APP_ORIGIN || process.env.APP_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export function appOrigin(): string {
  return appOrigins()[0]
}

export function handleError(err: unknown, c: Context) {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status)
  }
  console.error('Unhandled API error', err)
  const message = err instanceof Error ? err.message : 'Unexpected server error'
  return c.json({ error: message }, 500)
}

export function parseLimit(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback
}
