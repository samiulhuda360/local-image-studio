import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { configFromEnv, Describer, type DescribeRequest } from './ai.ts'

const MAX_BODY_BYTES = 6 * 1024 * 1024

type Next = (err?: unknown) => void
type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => void
interface MiddlewareHost {
  middlewares: { use(fn: Middleware): void }
}

/**
 * Serves the two API routes the browser uses, from the same process as the
 * dev and preview servers, so there is one command to run and no second port.
 *   GET  /api/status   -> whether a key is set and which model would answer
 *   POST /api/describe -> alt text, caption and subject box for a small preview
 */
export function aiPlugin(): Plugin {
  const describer = new Describer(configFromEnv(process.env))
  const attach = (server: MiddlewareHost): void => {
    server.middlewares.use(createHandler(describer))
  }
  return {
    name: 'local-image-studio-ai',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export function createHandler(describer: Describer, model = configFromEnv(process.env).model): Middleware {
  return (req, res, next) => {
    const url = req.url ?? ''
    if (url === '/api/status' && req.method === 'GET') {
      sendJson(res, 200, { aiEnabled: describer.enabled, model: describer.enabled ? model : '' })
      return
    }
    if (url === '/api/describe' && req.method === 'POST') {
      readJson(req)
        .then((body) => describer.describe(body as DescribeRequest))
        .then((result) => sendJson(res, 200, result))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Bad request'
          sendJson(res, 400, { error: message })
        })
      return
    }
    next()
  }
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Image too large; previews are capped at 6 MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Body must be JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}
