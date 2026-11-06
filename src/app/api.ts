import { getToken } from './auth'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    const here = location.pathname + location.search
    location.assign(`/sign-in?redirect_url=${encodeURIComponent(here)}`)
    throw new ApiError(401, 'Sign in required')
  }

  let body: unknown = null
  const type = res.headers.get('content-type') || ''
  if (type.includes('application/json')) body = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error || res.statusText || 'Request failed'
    throw new ApiError(res.status, message, body)
  }

  return body as T
}
