import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Runs the Vercel functions in api/ locally, so `npm run dev` and `npm run serve`
// behave like the deployed app. `load(name)` returns the function's module.
function apiMiddleware(load, logger) {
  return async (req, res, next) => {
    const name = req.url?.match(/^\/api\/([a-z]+)(?:\?|$)/)?.[1]
    if (!name) return next()
    let raw = ''
    for await (const chunk of req) raw += chunk
    try {
      req.body = raw ? JSON.parse(raw) : {}
    } catch {
      req.body = {}
    }
    res.status = (code) => {
      res.statusCode = code
      return res
    }
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(obj))
    }
    try {
      const { default: handler } = await load(name)
      await handler(req, res)
    } catch (err) {
      // Never take the server down; the app falls back to offline mode.
      logger.error(`[api/${name}] ${err.message}`)
      if (!res.headersSent) res.status(404).json({ error: 'API unavailable' })
    }
  }
}

// Gzip built JS and CSS on the fly (cached), for hosting over slow connections.
function gzipAssets(outDir) {
  const cache = new Map()
  return (req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!/^\/assets\/[\w.-]+\.(js|css)$/.test(url) || !/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) return next()
    const file = path.join(outDir, url)
    if (!fs.existsSync(file)) return next()
    if (!cache.has(file)) cache.set(file, zlib.gzipSync(fs.readFileSync(file), { level: 9 }))
    res.setHeader('Content-Type', `${url.endsWith('.js') ? 'text/javascript' : 'text/css'}; charset=utf-8`)
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Vary', 'Accept-Encoding')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(cache.get(file))
  }
}

function localApi() {
  return {
    name: 'beside-local-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware((name) => server.ssrLoadModule(`/api/${name}.js`), server.config.logger))
    },
    configurePreviewServer(server) {
      const root = server.config.root
      server.middlewares.use(apiMiddleware((name) => import(pathToFileURL(path.join(root, 'api', `${name}.js`)).href), server.config.logger))
      server.middlewares.use(gzipAssets(path.resolve(root, server.config.build.outDir)))
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), localApi()],
    // Temporary public links (localhost.run and similar tunnels) reach the preview server.
    preview: { allowedHosts: ['.lhr.life', '.localhost.run', '.trycloudflare.com'] },
  }
})
