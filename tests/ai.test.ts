import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheKey,
  configFromEnv,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  Describer,
  parseModelReply,
  spacingFromEnv,
  toBox,
  type AiConfig,
} from '../server/ai.ts'

const IMAGE = 'data:image/jpeg;base64,AAAA'
const REPLY = {
  alt: 'A red circle on a white background',
  caption: 'Bold and simple.',
  subject: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
}

function okResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })
}

let cacheDir: string
let cfg: AiConfig

beforeEach(() => {
  cacheDir = mkdtempSync(path.join(tmpdir(), 'studio-cache-'))
  cfg = {
    apiKey: 'test-key-not-real',
    baseUrl: 'https://example.invalid/v1',
    model: 'test-model',
    cacheDir,
    minSpacingMs: 2500,
    timeoutMs: 1000,
  }
})

afterEach(() => rmSync(cacheDir, { recursive: true, force: true }))

function makeDescriber(fetchImpl: typeof fetch, config = cfg) {
  let clock = 0
  const sleeps: number[] = []
  const describer = new Describer(config, {
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms)
      clock += ms
    },
  })
  return { describer, sleeps, tick: (ms: number) => (clock += ms) }
}

describe('configFromEnv', () => {
  it('falls back to the Gemini OpenAI-compatible endpoint and flash-lite', () => {
    const c = configFromEnv({}, '/root')
    expect(c.apiKey).toBe('')
    expect(c.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(c.model).toBe(DEFAULT_MODEL)
    expect(c.cacheDir).toBe(path.join('/root', '.cache', 'describe'))
  })
  it('reads AI_MIN_INTERVAL in seconds and never goes below 2.5 s', () => {
    expect(configFromEnv({ AI_MIN_INTERVAL: '4.5' }).minSpacingMs).toBe(4500)
    expect(spacingFromEnv('1')).toBe(2500)
    expect(spacingFromEnv('abc')).toBe(2500)
    expect(spacingFromEnv(undefined)).toBe(2500)
  })
  it('reads overrides and trims a trailing slash', () => {
    const c = configFromEnv({ AI_API_KEY: ' k ', AI_BASE_URL: 'https://x.invalid/v1/', AI_MODEL: 'm', AI_CACHE_DIR: '/c' })
    expect(c).toMatchObject({ apiKey: 'k', baseUrl: 'https://x.invalid/v1', model: 'm', cacheDir: '/c' })
  })
})

describe('parseModelReply', () => {
  it('reads plain JSON and fenced JSON', () => {
    expect(parseModelReply(JSON.stringify(REPLY))).toEqual(REPLY)
    expect(parseModelReply('Sure!\n```json\n' + JSON.stringify(REPLY) + '\n```')).toEqual(REPLY)
  })
  it('rejects replies without alt text and trims a box that overflows the image', () => {
    expect(parseModelReply('{"caption":"x"}')).toBeNull()
    expect(parseModelReply('not json')).toBeNull()
    const parsed = parseModelReply('{"alt":"a","subject":{"x":0.8,"y":0,"w":0.9,"h":0.5}}')
    expect(parsed?.subject).toEqual({ x: 0.8, y: 0, w: 0.2, h: 0.5 })
    expect(parsed?.caption).toBe('a')
  })
  it('reads boxes on the 0..1000 scale and rejects degenerate ones', () => {
    expect(toBox({ x: 250, y: 100, w: 500, h: 600 })).toEqual({ x: 0.25, y: 0.1, w: 0.5, h: 0.6 })
    expect(toBox({ x: 1, y: 1, w: 0, h: 0 })).toBeNull()
    expect(toBox({ x: 1, y: 0, w: 0.5, h: 1 })).toBeNull()
    expect(toBox({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(toBox({ x: 0, y: 0, w: 2000, h: 10 })).toBeNull()
    expect(toBox({ x: -0.1, y: 0, w: 0.5, h: 0.5 })).toBeNull()
  })
  it('drops a subject with missing numbers', () => {
    expect(parseModelReply('{"alt":"a","subject":{"x":0.1}}')?.subject).toBeNull()
  })
})

describe('Describer', () => {
  it('answers with a fallback and never calls fetch without a key', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { describer } = makeDescriber(fetchImpl, { ...cfg, apiKey: '' })
    const res = await describer.describe({ image: IMAGE })
    expect(res.source).toBe('fallback')
    expect(describer.enabled).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects non-image payloads before touching the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const { describer } = makeDescriber(fetchImpl)
    const res = await describer.describe({ image: 'hello' })
    expect(res.source).toBe('fallback')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends an OpenAI-style chat completion with the bearer key and parses the reply', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(okResponse(JSON.stringify(REPLY)))
    const { describer } = makeDescriber(fetchImpl)
    const res = await describer.describe({ image: IMAGE })
    expect(res).toMatchObject({ ...REPLY, source: 'ai', model: 'test-model' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.invalid/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key-not-real')
    const body = JSON.parse(String(init.body)) as { model: string; messages: { role: string; content: unknown }[] }
    expect(body.model).toBe('test-model')
    expect(body.messages[1]?.content).toEqual([
      { type: 'text', text: 'Describe this image.' },
      { type: 'image_url', image_url: { url: IMAGE } },
    ])
  })

  it('caches on disk and serves repeats without a call', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(okResponse(JSON.stringify(REPLY)))
    const { describer } = makeDescriber(fetchImpl)
    await describer.describe({ image: IMAGE })
    expect(readdirSync(cacheDir)).toEqual([`${cacheKey('test-model', IMAGE)}.json`])
    const again = await describer.describe({ image: IMAGE })
    expect(again.source).toBe('cache')
    expect(again.alt).toBe(REPLY.alt)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const second = makeDescriber(fetchImpl)
    expect((await second.describer.describe({ image: IMAGE })).source).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('keeps live calls at least 2.5 s apart', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => okResponse(JSON.stringify(REPLY)))
    const { describer, sleeps, tick } = makeDescriber(fetchImpl)
    await describer.describe({ image: 'data:image/jpeg;base64,one' })
    tick(1000)
    await describer.describe({ image: 'data:image/jpeg;base64,two' })
    expect(sleeps).toEqual([1500])
    tick(5000)
    await describer.describe({ image: 'data:image/jpeg;base64,three' })
    expect(sleeps).toEqual([1500])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('serialises concurrent requests through the same spacing', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => okResponse(JSON.stringify(REPLY)))
    const { describer, sleeps } = makeDescriber(fetchImpl)
    await Promise.all([
      describer.describe({ image: 'data:image/jpeg;base64,one' }),
      describer.describe({ image: 'data:image/jpeg;base64,two' }),
      describer.describe({ image: 'data:image/jpeg;base64,three' }),
    ])
    expect(sleeps).toEqual([2500, 2500])
  })

  it('retries once after a 429 and then gives up', async () => {
    const limited = vi.fn<typeof fetch>().mockResolvedValue(okResponse('', 429))
    const { describer, sleeps } = makeDescriber(limited)
    expect((await describer.describe({ image: IMAGE })).reason).toContain('429')
    expect(limited).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([8000])
    const recovers = vi.fn<typeof fetch>().mockResolvedValueOnce(okResponse('', 429)).mockResolvedValueOnce(okResponse(JSON.stringify(REPLY)))
    expect((await makeDescriber(recovers).describer.describe({ image: IMAGE })).source).toBe('ai')
  })

  it('falls back on HTTP errors, bad JSON and network failures, and does not cache them', async () => {
    const bad = vi.fn<typeof fetch>().mockResolvedValue(okResponse('', 500))
    expect((await makeDescriber(bad).describer.describe({ image: IMAGE })).reason).toContain('500')
    const junk = vi.fn<typeof fetch>().mockResolvedValue(okResponse('I cannot see the image'))
    expect((await makeDescriber(junk).describer.describe({ image: IMAGE })).source).toBe('fallback')
    const boom = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    const res = await makeDescriber(boom).describer.describe({ image: IMAGE })
    expect(res.source).toBe('fallback')
    expect(res.reason).not.toContain('test-key')
    expect(readdirSync(cacheDir)).toEqual([])
  })
})
