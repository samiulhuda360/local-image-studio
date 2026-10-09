import type { Box, Orientation } from './types.ts'

/** A4 paper: 210 x 297 mm. */
export const A4_RATIO = 297 / 210

/** Export sizes at 300 dpi. */
export const EXPORT_WIDTH: Record<Orientation, number> = { portrait: 2480, landscape: 3508 }

export interface PageSize {
  width: number
  height: number
}

/**
 * One card (front or back) on the page. Position and size are fractions of the
 * page so the same layout renders at any pixel size, on screen or for export.
 */
export interface Card {
  /** Centre of the card as a fraction of page width/height. */
  cx: number
  cy: number
  /** Card width as a fraction of page width. */
  width: number
  /** Degrees, clockwise. */
  rotation: number
}

export function pageSize(width: number, orientation: Orientation): PageSize {
  return orientation === 'portrait'
    ? { width, height: width * A4_RATIO }
    : { width, height: width / A4_RATIO }
}

/** The two slots a front and back default into: stacked for portrait, side by side for landscape. */
export function defaultSlots(orientation: Orientation): [Box, Box] {
  if (orientation === 'portrait') {
    return [
      { x: 0.1, y: 0.08, w: 0.8, h: 0.38 },
      { x: 0.1, y: 0.54, w: 0.8, h: 0.38 },
    ]
  }
  return [
    { x: 0.06, y: 0.15, w: 0.41, h: 0.7 },
    { x: 0.53, y: 0.15, w: 0.41, h: 0.7 },
  ]
}

/**
 * The largest card width (as a fraction of page width) that keeps an image of
 * `imageWidth` x `imageHeight` pixels inside `slot`, rotated by `rotation` degrees.
 */
export function fitWidth(
  imageWidth: number,
  imageHeight: number,
  slot: Box,
  page: PageSize,
  rotation = 0,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 0
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const slotW = slot.w * page.width
  const slotH = slot.h * page.height
  // Bounding box of the rotated image, per unit of unrotated image width.
  const aspect = imageHeight / imageWidth
  const boundsW = cos + aspect * sin
  const boundsH = sin + aspect * cos
  const widthPx = Math.min(slotW / boundsW, slotH / boundsH)
  return widthPx / page.width
}

export function placeInSlot(imageWidth: number, imageHeight: number, slot: Box, page: PageSize): Card {
  return {
    cx: slot.x + slot.w / 2,
    cy: slot.y + slot.h / 2,
    width: fitWidth(imageWidth, imageHeight, slot, page),
    rotation: 0,
  }
}

/** Pixel geometry of a card on a page of a given size. */
export function cardPixels(card: Card, imageWidth: number, imageHeight: number, page: PageSize) {
  const width = card.width * page.width
  const height = imageWidth > 0 ? width * (imageHeight / imageWidth) : 0
  return { cx: card.cx * page.width, cy: card.cy * page.height, width, height }
}

/** True when a page point (in pixels) lies inside the rotated card. */
export function hitTest(
  px: number,
  py: number,
  card: Card,
  imageWidth: number,
  imageHeight: number,
  page: PageSize,
): boolean {
  const { cx, cy, width, height } = cardPixels(card, imageWidth, imageHeight, page)
  const rad = (-card.rotation * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad)
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad)
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2
}

/** Moves a card by a pixel delta, keeping its centre on the page. */
export function moveCard(card: Card, dxPx: number, dyPx: number, page: PageSize): Card {
  return {
    ...card,
    cx: clamp(card.cx + dxPx / page.width, 0, 1),
    cy: clamp(card.cy + dyPx / page.height, 0, 1),
  }
}

export function scaleCard(card: Card, factor: number): Card {
  return { ...card, width: clamp(card.width * factor, 0.05, 1.5) }
}

export function rotateCard(card: Card, degrees: number): Card {
  return { ...card, rotation: ((card.rotation + degrees) % 360 + 360) % 360 }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
