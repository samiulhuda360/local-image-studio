// Starts the dev server (with its API route) and a headless Chromium, and
// hands back a page whose window.__studio runs the app's own pipeline.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import type { StudioWindow } from '../src/harnessTypes.ts'

export type { StudioWindow }
declare const window: StudioWindow

/**
 * The browser the evals drive. Set CHROME_PATH to any Chrome or Chromium
 * executable; when it is unset, Playwright's own Chromium is used, installed with
 * `npx playwright-core install chromium-headless-shell`.
 */
export function chromePath(): string | undefined {
  return process.env.CHROME_PATH?.trim() || undefined
}

export interface Harness {
  page: Page
  close(): Promise<void>
}

export async function startHarness(): Promise<Harness> {
  const server: ViteDevServer = await createServer({ root: process.cwd(), server: { port: 0 }, logLevel: 'error' })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Dev server did not report a port')
  const url = `http://localhost:${address.port}/`

  const browser: Browser = await chromium.launch({ executablePath: chromePath(), headless: true })
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__studio), null, { timeout: 30_000 })

  return {
    page,
    async close() {
      await browser.close()
      await server.close()
    },
  }
}

export const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
}

export function readImage(file: string): { base64: string; mime: string; bytes: number; name: string } {
  const buf = readFileSync(file)
  const mime = MIME[path.extname(file).toLowerCase()]
  if (!mime) throw new Error(`Not an image: ${file}`)
  return { base64: buf.toString('base64'), mime, bytes: buf.length, name: path.basename(file) }
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`
}
