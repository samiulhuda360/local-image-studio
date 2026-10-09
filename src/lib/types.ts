/** A rectangle expressed as fractions (0..1) of the image width and height. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type Orientation = 'portrait' | 'landscape'

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface Rgb {
  r: number
  g: number
  b: number
}

/** What the describe step returns, whether it came from the model, the disk cache or the local fallback. */
export interface DescribeResult {
  alt: string
  caption: string
  /** Where the main subject sits, if the model could tell. Used to anchor the crop suggestion. */
  subject: Box | null
  source: 'ai' | 'cache' | 'fallback'
  model?: string
  reason?: string
}

export interface EncodeOptions {
  format: OutputFormat
  /** 0..1, ignored for PNG. */
  quality: number
  /** Longest side in pixels; the image is never enlarged. 0 keeps the original size. */
  maxSide: number
}
