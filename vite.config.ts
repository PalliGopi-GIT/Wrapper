import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'cadence-viewer-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/s\/[^/?#]+/.test(req.url)) req.url = '/viewer.html'
          next()
        })
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        viewer: resolve(process.cwd(), 'viewer.html'),
      },
    },
  },
})
