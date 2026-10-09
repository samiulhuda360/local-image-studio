import { describe, expect, it } from 'vitest'
import { boxToPixels, clampBox, cropAroundSubject, saliencyGrid, suggestCrop } from '../src/lib/crop.ts'

/** A flat grey image with a textured, colourful square somewhere in it. */
function textured(width: number, height: number, box: { x: number; y: number; w: number; h: number }) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h
      if (inside) {
        const check = (x + y) % 2 === 0
        data[i] = check ? 240 : 20
        data[i + 1] = check ? 60 : 200
        data[i + 2] = 40
      } else {
        data[i] = data[i + 1] = data[i + 2] = 128
      }
      data[i + 3] = 255
    }
  }
  return data
}

describe('saliencyGrid', () => {
  it('scores the textured region high and the flat region zero', () => {
    const data = textured(96, 96, { x: 64, y: 0, w: 32, h: 32 })
    const sal = saliencyGrid(data, 96, 96, 6, 6)
    expect(sal.cells[5]).toBe(1)
    expect(sal.cells[0]).toBeLessThan(0.001)
    expect(sal.cells[35]).toBeLessThan(0.001)
  })
  it('handles empty input', () => {
    expect(saliencyGrid(new Uint8ClampedArray(0), 0, 0).cells.every((c) => c === 0)).toBe(true)
  })
})

describe('suggestCrop', () => {
  it('frames the interesting corner instead of the centre', () => {
    const data = textured(240, 240, { x: 170, y: 10, w: 60, h: 60 })
    const sal = saliencyGrid(data, 240, 240)
    const crop = suggestCrop(sal, 240, 240, 1)
    const centreX = crop.x + crop.w / 2
    const centreY = crop.y + crop.h / 2
    expect(centreX).toBeGreaterThan(0.6)
    expect(centreY).toBeLessThan(0.4)
    expect(crop.x).toBeLessThanOrEqual(175 / 240)
    expect(crop.x + crop.w).toBeGreaterThanOrEqual(225 / 240)
  })
  it('respects the aspect ratio in pixels', () => {
    const data = textured(400, 200, { x: 0, y: 0, w: 50, h: 50 })
    const crop = suggestCrop(saliencyGrid(data, 400, 200), 400, 200, 16 / 9)
    const px = boxToPixels(crop, 400, 200)
    expect(px.w / px.h).toBeCloseTo(16 / 9, 1)
  })
  it('falls back to the full frame for an empty image', () => {
    expect(suggestCrop(saliencyGrid(new Uint8ClampedArray(0), 0, 0), 0, 0, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

describe('cropAroundSubject', () => {
  it('contains the subject and keeps the aspect', () => {
    const subject = { x: 0.6, y: 0.1, w: 0.2, h: 0.3 }
    const crop = cropAroundSubject(subject, 1200, 800, 1)
    expect(crop.x).toBeLessThanOrEqual(subject.x)
    expect(crop.y).toBeLessThanOrEqual(subject.y)
    expect(crop.x + crop.w).toBeGreaterThanOrEqual(subject.x + subject.w)
    expect(crop.y + crop.h).toBeGreaterThanOrEqual(subject.y + subject.h)
    expect((crop.w * 1200) / (crop.h * 800)).toBeCloseTo(1, 5)
  })
  it('never leaves the image even for an edge subject', () => {
    const crop = cropAroundSubject({ x: 0.95, y: 0.95, w: 0.05, h: 0.05 }, 1000, 1000, 1)
    expect(crop.x + crop.w).toBeLessThanOrEqual(1)
    expect(crop.y + crop.h).toBeLessThanOrEqual(1)
  })
})

describe('clampBox', () => {
  it('pulls boxes back inside the unit square', () => {
    expect(clampBox({ x: 0.9, y: -1, w: 0.5, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 })
  })
})
