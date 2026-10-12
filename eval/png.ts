// A tiny PNG writer and a few drawing helpers, so the labelled sample set can
// be generated from code without any image library.
import { deflateSync } from 'node:zlib'

export interface Rgb {
  r: number
  g: number
  b: number
}

export class Raster {
  readonly data: Uint8Array
  readonly width: number
  readonly height: number

  constructor(width: number, height: number, background: Rgb = { r: 255, g: 255, b: 255 }) {
    this.width = width
    this.height = height
    this.data = new Uint8Array(width * height * 3)
    this.fillRect(0, 0, width, height, background)
  }

  set(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const i = (y * this.width + x) * 3
    this.data[i] = c.r
    this.data[i + 1] = c.g
    this.data[i + 2] = c.b
  }

  fillRect(x0: number, y0: number, w: number, h: number, c: Rgb): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c)
  }

  fillCircle(cx: number, cy: number, radius: number, c: Rgb): void {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) this.set(x, y, c)
      }
    }
  }

  fillTriangle(cx: number, baseY: number, size: number, c: Rgb): void {
    for (let i = 0; i < size; i++) {
      const y = baseY - i
      const half = Math.round(((size - i) / size) * (size / 2))
      for (let x = cx - half; x <= cx + half; x++) this.set(x, y, c)
    }
  }

  toPng(): Buffer {
    const raw = Buffer.alloc((this.width * 3 + 1) * this.height)
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 3 + 1)] = 0
      Buffer.from(this.data.buffer, y * this.width * 3, this.width * 3).copy(raw, y * (this.width * 3 + 1) + 1)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.width, 0)
    ihdr.writeUInt32BE(this.height, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 2 // colour type: RGB
    ihdr[10] = 0
    ihdr[11] = 0
    ihdr[12] = 0
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([len, typeAndData, crc])
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
