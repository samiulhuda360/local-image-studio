import { cardPixels, pageSize, type Card } from './merge.ts'
import type { Box, EncodeOptions, Orientation, OutputFormat } from './types.ts'

export type { EncodeOptions }

export interface LoadedImage {
  bitmap: ImageBitmap
  width: number
  height: number
  fileName: string
  bytes: number
  type: string
}

export async function loadImage(file: File | Blob, fileName = 'image'): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file)
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    fileName: file instanceof File ? file.name : fileName,
    bytes: file.size,
    type: file.type,
  }
}

export function targetSize(width: number, height: number, maxSide: number) {
  if (maxSide <= 0 || Math.max(width, height) <= maxSide) return { width, height }
  const scale = maxSide / Math.max(width, height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Could not encode as ${format}`))),
      format,
      format === 'image/png' ? undefined : quality,
    )
  })
}

/** Resizes (down only), optionally crops, and encodes an image. Everything stays in the browser. */
export async function resizeAndEncode(image: LoadedImage, opts: EncodeOptions, crop?: Box): Promise<Blob> {
  const srcX = crop ? Math.round(crop.x * image.width) : 0
  const srcY = crop ? Math.round(crop.y * image.height) : 0
  const srcW = crop ? Math.max(1, Math.round(crop.w * image.width)) : image.width
  const srcH = crop ? Math.max(1, Math.round(crop.h * image.height)) : image.height
  const { width, height } = targetSize(srcW, srcH, opts.maxSide)
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  if (opts.format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image.bitmap, srcX, srcY, srcW, srcH, 0, 0, width, height)
  return toBlob(canvas, opts.format, opts.quality)
}

/** Pixel data of a downscaled copy, for the local crop and colour analysis. */
export function samplePixels(image: LoadedImage, maxSide = 320): ImageData {
  const { width, height } = targetSize(image.width, image.height, maxSide)
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.drawImage(image.bitmap, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

/** A small JPEG data URL of the image, which is all the describe step ever sends. */
export async function previewDataUrl(image: LoadedImage, maxSide = 768): Promise<string> {
  const blob = await resizeAndEncode(image, { format: 'image/jpeg', quality: 0.8, maxSide })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob'))
    reader.readAsDataURL(blob)
  })
}

export interface PlacedCard {
  card: Card
  image: LoadedImage
}

/** Draws the merged page onto a canvas context at the given pixel size. */
export function drawPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  orientation: Orientation,
  cards: PlacedCard[],
  guides = false,
): void {
  const page = pageSize(width, orientation)
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, page.width, page.height)
  for (const { card, image } of cards) {
    const px = cardPixels(card, image.width, image.height, page)
    ctx.save()
    ctx.translate(px.cx, px.cy)
    ctx.rotate((card.rotation * Math.PI) / 180)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.bitmap, -px.width / 2, -px.height / 2, px.width, px.height)
    if (guides) {
      ctx.strokeStyle = '#2f6f68'
      ctx.lineWidth = Math.max(1, page.width / 400)
      ctx.setLineDash([page.width / 80, page.width / 120])
      ctx.strokeRect(-px.width / 2, -px.height / 2, px.width, px.height)
    }
    ctx.restore()
  }
  ctx.restore()
}

export async function exportPage(
  orientation: Orientation,
  cards: PlacedCard[],
  format: OutputFormat,
  quality: number,
  width: number,
): Promise<Blob> {
  const page = pageSize(width, orientation)
  const canvas = makeCanvas(Math.round(page.width), Math.round(page.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  drawPage(ctx, page.width, orientation, cards)
  return toBlob(canvas, format, quality)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
