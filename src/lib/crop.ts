import type { Box } from './types.ts'
import { clamp } from './merge.ts'

export interface Saliency {
  cols: number
  rows: number
  /** Row-major grid of per-cell interest scores, 0..1. */
  cells: Float32Array
}

/** Named aspect ratios the crop tool offers. */
export const ASPECTS: Record<string, number> = {
  Square: 1,
  Landscape: 4 / 3,
  Widescreen: 16 / 9,
  Portrait: 3 / 4,
  Story: 9 / 16,
}

/**
 * Scores each grid cell by local contrast and colourfulness. Plain walls and
 * skies score low; faces, text, objects and edges score high. No model involved.
 */
export function saliencyGrid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cols = 24,
  rows = 24,
): Saliency {
  const cells = new Float32Array(cols * rows)
  if (width === 0 || height === 0) return { cols, rows, cells }
  const cellW = width / cols
  const cellH = height / rows
  let max = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellW)
      const y0 = Math.floor(r * cellH)
      const x1 = Math.max(x0 + 1, Math.floor((c + 1) * cellW))
      const y1 = Math.max(y0 + 1, Math.floor((r + 1) * cellH))
      let n = 0
      let sum = 0
      let sumSq = 0
      let sat = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4
          const red = data[i] ?? 0
          const green = data[i + 1] ?? 0
          const blue = data[i + 2] ?? 0
          const lum = 0.299 * red + 0.587 * green + 0.114 * blue
          sum += lum
          sumSq += lum * lum
          sat += Math.max(red, green, blue) - Math.min(red, green, blue)
          n++
        }
      }
      const mean = sum / n
      const variance = Math.max(0, sumSq / n - mean * mean)
      const contrast = Math.sqrt(variance) / 128
      const colour = sat / n / 255
      const score = contrast * 0.7 + colour * 0.3
      cells[r * cols + c] = score
      if (score > max) max = score
    }
  }
  if (max > 0) for (let i = 0; i < cells.length; i++) cells[i] = (cells[i] ?? 0) / max
  return { cols, rows, cells }
}

/**
 * Picks the crop window of the given aspect ratio that covers the most
 * interesting part of the image. Larger windows are preferred unless a smaller
 * one is clearly denser in interest.
 */
export function suggestCrop(sal: Saliency, imageWidth: number, imageHeight: number, aspect: number): Box {
  const { cols, rows, cells } = sal
  if (imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0, w: 1, h: 1 }
  const maxW = Math.min(1, (aspect * imageHeight) / imageWidth)
  const maxH = Math.min(1, imageWidth / (aspect * imageHeight))
  let best: Box = { x: (1 - maxW) / 2, y: (1 - maxH) / 2, w: maxW, h: maxH }
  let bestScore = -Infinity
  for (const size of [1, 0.85, 0.7, 0.55, 0.4]) {
    const w = maxW * size
    const h = maxH * size
    const wCells = Math.max(1, Math.round(w * cols))
    const hCells = Math.max(1, Math.round(h * rows))
    for (let r = 0; r + hCells <= rows; r++) {
      for (let c = 0; c + wCells <= cols; c++) {
        let sum = 0
        for (let rr = r; rr < r + hCells; rr++) {
          for (let cc = c; cc < c + wCells; cc++) sum += cells[rr * cols + cc] ?? 0
        }
        const area = wCells * hCells
        // Mean interest, weighted towards bigger windows so we don't zoom into one edge.
        const score = (sum / area) * Math.pow(area, 0.35)
        if (score > bestScore) {
          bestScore = score
          best = { x: (c + wCells / 2) / cols - w / 2, y: (r + hCells / 2) / rows - h / 2, w, h }
        }
      }
    }
  }
  return clampBox(best)
}

/** Fits a crop of `aspect` around a subject box, growing it to the largest size that still fits the image. */
export function cropAroundSubject(subject: Box, imageWidth: number, imageHeight: number, aspect: number): Box {
  const maxW = Math.min(1, (aspect * imageHeight) / imageWidth)
  const maxH = Math.min(1, imageWidth / (aspect * imageHeight))
  // Smallest crop of this aspect that contains the subject.
  let w = Math.max(subject.w, (subject.h * imageHeight * aspect) / imageWidth)
  let h = (w * imageWidth) / (aspect * imageHeight)
  // Add breathing room, then clamp to what fits.
  w = Math.min(maxW, w * 1.25)
  h = Math.min(maxH, h * 1.25)
  if (w / maxW > h / maxH) h = (w * imageWidth) / (aspect * imageHeight)
  else w = (h * aspect * imageHeight) / imageWidth
  const cx = subject.x + subject.w / 2
  const cy = subject.y + subject.h / 2
  return clampBox({ x: cx - w / 2, y: cy - h / 2, w, h })
}

export function clampBox(box: Box): Box {
  const w = clamp(box.w, 0.01, 1)
  const h = clamp(box.h, 0.01, 1)
  return { x: clamp(box.x, 0, 1 - w), y: clamp(box.y, 0, 1 - h), w, h }
}

export function boxToPixels(box: Box, width: number, height: number) {
  return {
    x: Math.round(box.x * width),
    y: Math.round(box.y * height),
    w: Math.max(1, Math.round(box.w * width)),
    h: Math.max(1, Math.round(box.h * height)),
  }
}
