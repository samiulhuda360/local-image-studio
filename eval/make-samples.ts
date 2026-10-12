// Generates the labelled synthetic sample set in eval/labelled/. Every image
// has a known subject, so the alt-text evaluation has ground truth to check.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Raster, type Rgb } from './png.ts'

const RED: Rgb = { r: 220, g: 40, b: 40 }
const BLUE: Rgb = { r: 40, g: 80, b: 220 }
const GREEN: Rgb = { r: 40, g: 170, b: 70 }
const YELLOW: Rgb = { r: 245, g: 205, b: 30 }
const BLACK: Rgb = { r: 20, g: 20, b: 20 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const ORANGE: Rgb = { r: 240, g: 140, b: 30 }

const samples: Record<string, () => Raster> = {
  'red-circle': () => {
    const r = new Raster(640, 480)
    r.fillCircle(320, 240, 120, RED)
    return r
  },
  'blue-square-top-left': () => {
    const r = new Raster(640, 480)
    r.fillRect(40, 40, 160, 160, BLUE)
    return r
  },
  'three-green-stripes': () => {
    const r = new Raster(640, 480)
    for (const y of [60, 200, 340]) r.fillRect(0, y, 640, 80, GREEN)
    return r
  },
  'yellow-triangle': () => {
    const r = new Raster(480, 640)
    r.fillTriangle(240, 500, 320, YELLOW)
    return r
  },
  'checkerboard': () => {
    const r = new Raster(512, 512)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) r.fillRect(x * 64, y * 64, 64, 64, BLACK)
    return r
  },
  'orange-ring': () => {
    const r = new Raster(600, 600)
    r.fillCircle(300, 300, 200, ORANGE)
    r.fillCircle(300, 300, 130, WHITE)
    return r
  },
  'black-bar-on-blue': () => {
    const r = new Raster(640, 360, BLUE)
    r.fillRect(0, 150, 640, 60, BLACK)
    return r
  },
  'two-red-circles': () => {
    const r = new Raster(800, 400)
    r.fillCircle(220, 200, 110, RED)
    r.fillCircle(580, 200, 110, RED)
    return r
  },
}

const outDir = path.resolve('eval', 'labelled')
mkdirSync(outDir, { recursive: true })
for (const [name, make] of Object.entries(samples)) {
  const file = path.join(outDir, `${name}.png`)
  writeFileSync(file, make().toPng())
  console.log(`wrote ${path.relative(process.cwd(), file)}`)
}
