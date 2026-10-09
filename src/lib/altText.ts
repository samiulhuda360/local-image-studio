import { humaniseFileName } from './format.ts'
import type { Rgb } from './types.ts'

/** Average colour of the pixels, sampling every `step`-th pixel. */
export function dominantColour(data: Uint8ClampedArray, step = 7): Rgb {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i + 2 < data.length; i += 4 * step) {
    r += data[i] ?? 0
    g += data[i + 1] ?? 0
    b += data[i + 2] ?? 0
    n++
  }
  if (n === 0) return { r: 0, g: 0, b: 0 }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

/** A plain-English name for a colour, good enough for "mostly blue tones". */
export function colourName({ r, g, b }: Rgb): string {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2 / 255
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1)) / 255
  if (sat < 0.12) {
    if (light > 0.85) return 'white'
    if (light < 0.18) return 'black'
    return 'grey'
  }
  let hue = 0
  if (max === r) hue = ((g - b) / (max - min)) % 6
  else if (max === g) hue = (b - r) / (max - min) + 2
  else hue = (r - g) / (max - min) + 4
  hue = ((hue * 60) % 360 + 360) % 360
  if (hue < 15 || hue >= 345) return 'red'
  if (hue < 40) return light < 0.4 ? 'brown' : 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 165) return 'green'
  if (hue < 200) return 'teal'
  if (hue < 255) return 'blue'
  if (hue < 290) return 'violet'
  return 'pink'
}

export interface FallbackInput {
  fileName: string
  width: number
  height: number
  colour: Rgb
}

/**
 * Alt text that needs no model: shape, size, colour and whatever the file name
 * gives away. Honest about what it does not know.
 */
export function fallbackAltText({ fileName, width, height, colour }: FallbackInput): string {
  const shape = width > height * 1.15 ? 'landscape' : height > width * 1.15 ? 'portrait' : 'square'
  const subject = humaniseFileName(fileName)
  const tone = colourName(colour)
  const subjectPart = subject ? `Image of ${subject}` : 'Image'
  return `${subjectPart}, ${shape} orientation, ${width} by ${height} pixels, mostly ${tone} tones.`
}
