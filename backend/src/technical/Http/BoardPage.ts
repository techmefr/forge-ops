import { Hono } from 'hono'
import { readFileSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

const NUL = String.fromCharCode(0)

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

export type BoardPageInput = {
  distDir: string
}

function decodePath(requestedPath: string): string | null {
  try {
    return decodeURIComponent(requestedPath)
  } catch {
    return null
  }
}

export function readWithin(root: string, requestedPath: string): Buffer | null {
  const decoded = decodePath(requestedPath)
  if (decoded === null || decoded.includes(NUL) || decoded.includes('\\')) {
    return null
  }
  const target = resolve(root, `.${decoded}`)
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    return null
  }
  try {
    if (!statSync(target).isFile()) {
      return null
    }
    return readFileSync(target)
  } catch {
    return null
  }
}

export function createBoardPage({ distDir }: BoardPageInput): Hono {
  const root = resolve(distDir)
  const page = new Hono()

  page.all('/api/*', (context) => context.json({ error: 'RouteNotFound' }, 404))

  page.get('/*', (context) => {
    const requestedPath = context.req.path
    const extension = extname(requestedPath)

    if (extension !== '') {
      const asset = readWithin(root, requestedPath)
      if (asset === null) {
        return context.json({ error: 'AssetNotFound' }, 404)
      }
      return context.body(new Uint8Array(asset), 200, {
        'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      })
    }

    let document: Buffer
    try {
      document = readFileSync(join(root, 'index.html'))
    } catch {
      return context.json({ error: 'FrontNotBuilt' }, 503)
    }

    context.header('cache-control', 'no-store')
    return context.html(document.toString('utf-8'))
  })

  return page
}
