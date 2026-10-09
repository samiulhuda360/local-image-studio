import type { OutputFormat } from './types.ts'

export const EXTENSIONS: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Percentage saved going from `before` to `after` bytes. Negative when the output grew. */
export function reductionPercent(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.round(((before - after) / before) * 1000) / 10
}

/** Strips the extension and any path from a file name. */
export function baseName(fileName: string): string {
  const last = fileName.split(/[\\/]/).pop() ?? fileName
  const dot = last.lastIndexOf('.')
  return dot > 0 ? last.slice(0, dot) : last
}

export function outputFileName(fileName: string, format: OutputFormat, suffix = ''): string {
  return `${baseName(fileName)}${suffix}.${EXTENSIONS[format]}`
}

/** Turns "IMG_2024-01-03_beach day.JPG" into "beach day" style words a sentence can use. */
export function humaniseFileName(fileName: string): string {
  const words = baseName(fileName)
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b(img|image|dsc|dscn|pxl|photo|screenshot|screen shot|copy|final|edited|wa)\b/gi, ' ')
    .replace(/\b[a-z]*\d[\w:-]*\b/gi, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
  return words.join(' ').toLowerCase()
}
