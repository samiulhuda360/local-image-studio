import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Box, DescribeResult } from '../src/lib/types.ts'

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const DEFAULT_MODEL = 'gemini-flash-lite-latest'
export const MIN_SPACING_MS = 2500
export const RETRY_AFTER_MS = 8000
/** Smallest subject side, as a fraction of the image, worth cropping around. */
export const MIN_SUBJECT = 0.02

export interface DescribeRequest {
  /** A small JPEG data URL. */
  image: string
  fileName?: string
}

export interface AiConfig {
  apiKey: string
  baseUrl: string
  model: string
  cacheDir: string
  minSpacingMs: number
  timeoutMs: number
}

export interface AiDeps {
  fetchImpl: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
}

/** Reads settings from the environment. The key is read here and nowhere else; it is never logged or written. */
export function configFromEnv(env: NodeJS.ProcessEnv, root = process.cwd()): AiConfig {
  return {
    apiKey: env.AI_API_KEY?.trim() ?? '',
    baseUrl: (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
    cacheDir: env.AI_CACHE_DIR?.trim() || path.join(root, '.cache', 'describe'),
    minSpacingMs: MIN_SPACING_MS,
    timeoutMs: 30_000,
  }
}

export const SYSTEM_PROMPT = `You write accessibility alt text for images. Reply with JSON only, no prose, shaped exactly like:
{"alt": string, "caption": string, "subject": {"x": number, "y": number, "w": number, "h": number} | null}
- "alt": one factual sentence, at most 125 characters, naming what is in the image. No "image of".
- "caption": one or two friendly sentences for a web page.
- "subject": the bounding box of the main subject, with x and y as the top-left corner and w and h as width and height, all as fractions of the image size (0 to 1), or null if the image has no clear subject.`

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter. */
export function parseModelReply(text: string): Pick<DescribeResult, 'alt' | 'caption' | 'subject'> | null {
  const stripped = text.replace(/```(?:json)?/gi, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const alt = typeof obj.alt === 'string' ? obj.alt.trim() : ''
  if (!alt) return null
  const caption = typeof obj.caption === 'string' ? obj.caption.trim() : alt
  return { alt, caption, subject: toBox(obj.subject) }
}

/**
 * Turns a model's subject box into fractions of the image. Accepts 0..1
 * fractions or the 0..1000 scale Gemini models often use, and rejects boxes
 * too small to frame a crop around.
 */
export function toBox(value: unknown): Box | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const nums = [v.x, v.y, v.w, v.h]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null
  const max = Math.max(...(nums as number[]))
  if (max > 1000) return null
  const scale = max > 1 ? 1000 : 1
  const [x, y, w, h] = (nums as number[]).map((n) => Math.min(1, n / scale)) as [number, number, number, number]
  const round = (n: number) => Math.round(n * 10_000) / 10_000
  const box = { x: round(x), y: round(y), w: round(Math.min(w, 1 - x)), h: round(Math.min(h, 1 - y)) }
  if (box.w < MIN_SUBJECT || box.h < MIN_SUBJECT) return null
  return box
}

export function cacheKey(model: string, image: string): string {
  return createHash('sha256').update(model).update('\n').update(image).digest('hex')
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null } }[]
}

/**
 * Describes images through an OpenAI-compatible chat endpoint, with a disk
 * cache and a minimum gap between live calls. Without a key it answers with a
 * fallback marker so the browser can build its own description.
 */
export class Describer {
  private lastCallAt = -Infinity
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly cfg: AiConfig,
    private readonly deps: AiDeps = {
      fetchImpl: fetch,
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    },
  ) {}

  get enabled(): boolean {
    return this.cfg.apiKey.length > 0
  }

  async describe(req: DescribeRequest): Promise<DescribeResult> {
    if (!req.image.startsWith('data:image/')) {
      return fallback('The request did not contain an image.')
    }
    if (!this.enabled) return fallback('No AI_API_KEY set; using the local description.')

    const key = cacheKey(this.cfg.model, req.image)
    const cached = await this.readCache(key)
    if (cached) return { ...cached, source: 'cache' }

    // Serialise live calls so two tabs cannot both skip the spacing.
    const run = this.queue.then(() => this.callModel(req.image))
    this.queue = run.catch(() => undefined)
    const result = await run
    if (result.source === 'ai') await this.writeCache(key, result)
    return result
  }

  private async callModel(image: string): Promise<DescribeResult> {
    const first = await this.callOnce(image)
    if (first.source === 'fallback' && first.reason?.includes('429')) {
      // Rate limited: back off once, then give up gracefully.
      await this.deps.sleep(RETRY_AFTER_MS)
      return this.callOnce(image)
    }
    return first
  }

  private async callOnce(image: string): Promise<DescribeResult> {
    const wait = this.lastCallAt + this.cfg.minSpacingMs - this.deps.now()
    if (wait > 0) await this.deps.sleep(wait)
    this.lastCallAt = this.deps.now()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs)
    try {
      const res = await this.deps.fetchImpl(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this image.' },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      })
      if (!res.ok) return fallback(`The model endpoint replied ${res.status}.`)
      const data = (await res.json()) as ChatCompletion
      const text = data.choices?.[0]?.message?.content ?? ''
      const parsed = parseModelReply(text)
      if (!parsed) return fallback('The model reply was not valid JSON.')
      return { ...parsed, source: 'ai', model: this.cfg.model }
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error'
      return fallback(name === 'AbortError' ? 'The model call timed out.' : 'The model call failed.')
    } finally {
      clearTimeout(timer)
    }
  }

  private async readCache(key: string): Promise<DescribeResult | null> {
    try {
      const raw = await readFile(path.join(this.cfg.cacheDir, `${key}.json`), 'utf8')
      const cached = JSON.parse(raw) as DescribeResult
      // Re-validate on the way out so older cache entries obey the current box rules.
      return { ...cached, subject: toBox(cached.subject) }
    } catch {
      return null
    }
  }

  private async writeCache(key: string, result: DescribeResult): Promise<void> {
    try {
      await mkdir(this.cfg.cacheDir, { recursive: true })
      await writeFile(path.join(this.cfg.cacheDir, `${key}.json`), JSON.stringify(result))
    } catch {
      // A failed cache write only costs a repeat call later.
    }
  }
}

export function fallback(reason: string): DescribeResult {
  return { alt: '', caption: '', subject: null, source: 'fallback', reason }
}
