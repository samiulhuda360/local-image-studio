import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { Describer } from '../server/ai.ts'
import { createHandler } from '../server/aiPlugin.ts'

function fakeRequest(method: string, url: string, body?: string) {
  const req = new EventEmitter() as EventEmitter & IncomingMessage
  req.method = method
  req.url = url
  req.destroy = vi.fn() as unknown as IncomingMessage['destroy']
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

function fakeResponse() {
  let finish!: () => void
  const done = new Promise<void>((r) => (finish = r))
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    done,
    setHeader(k: string, v: string) {
      res.headers[k] = v
    },
    end(chunk: string) {
      res.body = chunk
      finish()
    },
  }
  return res as typeof res & ServerResponse
}

const noKey = new Describer({
  apiKey: '',
  baseUrl: 'https://x.invalid',
  model: 'm',
  cacheDir: '.',
  minSpacingMs: 0,
  timeoutMs: 10,
})

describe('createHandler', () => {
  it('reports status without a key', async () => {
    const handler = createHandler(noKey, 'm')
    const res = fakeResponse()
    handler(fakeRequest('GET', '/api/status'), res, () => {})
    await res.done
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ aiEnabled: false, model: '' })
  })

  it('describes through the describer', async () => {
    const handler = createHandler(noKey)
    const res = fakeResponse()
    handler(fakeRequest('POST', '/api/describe', JSON.stringify({ image: 'data:image/jpeg;base64,AAAA' })), res, () => {})
    await res.done
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ source: 'fallback' })
  })

  it('returns 400 for a bad body', async () => {
    const handler = createHandler(noKey)
    const res = fakeResponse()
    handler(fakeRequest('POST', '/api/describe', '{nope'), res, () => {})
    await res.done
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('Body must be JSON')
  })

  it('passes other routes on', () => {
    const next = vi.fn()
    createHandler(noKey)(fakeRequest('GET', '/index.html'), fakeResponse(), next)
    expect(next).toHaveBeenCalledOnce()
  })
})
