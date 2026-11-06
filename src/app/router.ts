export type Route =
  | { name: 'dashboard' }
  | { name: 'editor'; id: string }
  | { name: 'sign-in' }
  | { name: 'sign-up' }
  | { name: 'share'; token: string }
  | { name: 'not-found' }

export function parseRoute(path = location.pathname): Route {
  if (path === '/' || path === '') return { name: 'dashboard' }
  if (path === '/sign-in') return { name: 'sign-in' }
  if (path === '/sign-up') return { name: 'sign-up' }

  const editor = path.match(/^\/d\/([^/]+)\/?$/)
  if (editor) return { name: 'editor', id: editor[1] }

  const share = path.match(/^\/s\/([^/]+)\/?$/)
  if (share) return { name: 'share', token: share[1] }

  return { name: 'not-found' }
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (location.pathname + location.search === to) return
  if (opts.replace) history.replaceState({}, '', to)
  else history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function startRouter(render: (route: Route) => void) {
  const run = () => render(parseRoute())
  window.addEventListener('popstate', run)
  run()
}

export function redirectUrl(): string {
  return new URLSearchParams(location.search).get('redirect_url') || '/'
}
