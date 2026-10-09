import { describe, expect, it } from 'vitest'
import {
  A4_RATIO,
  cardPixels,
  defaultSlots,
  fitWidth,
  hitTest,
  moveCard,
  pageSize,
  placeInSlot,
  rotateCard,
  scaleCard,
} from '../src/lib/merge.ts'

const portrait = pageSize(1000, 'portrait')
const landscape = pageSize(1000, 'landscape')

describe('pageSize', () => {
  it('keeps A4 proportions both ways', () => {
    expect(portrait.height).toBeCloseTo(1000 * A4_RATIO)
    expect(landscape.height).toBeCloseTo(1000 / A4_RATIO)
  })
})

describe('defaultSlots', () => {
  it('stacks cards for portrait and puts them side by side for landscape', () => {
    const [top, bottom] = defaultSlots('portrait')
    expect(top.y + top.h).toBeLessThanOrEqual(bottom.y)
    const [left, right] = defaultSlots('landscape')
    expect(left.x + left.w).toBeLessThanOrEqual(right.x)
  })
  it('stays inside the page', () => {
    for (const o of ['portrait', 'landscape'] as const) {
      for (const s of defaultSlots(o)) {
        expect(s.x).toBeGreaterThanOrEqual(0)
        expect(s.y).toBeGreaterThanOrEqual(0)
        expect(s.x + s.w).toBeLessThanOrEqual(1)
        expect(s.y + s.h).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('fitWidth', () => {
  const slot = { x: 0.1, y: 0.1, w: 0.8, h: 0.3 }
  it('fits a wide ID card by the slot height when the width would overflow it', () => {
    const w = fitWidth(1600, 1000, slot, portrait)
    const px = w * portrait.width
    expect(px * (1000 / 1600)).toBeCloseTo(slot.h * portrait.height, 5)
    expect(px).toBeLessThanOrEqual(slot.w * portrait.width)
  })
  it('accounts for rotation', () => {
    const upright = fitWidth(1600, 1000, slot, portrait, 0)
    const rotated = fitWidth(1600, 1000, slot, portrait, 90)
    expect(rotated).toBeLessThan(upright)
    // Turned on its side the 1600 px edge runs vertically, so the slot height limits it.
    expect(rotated * portrait.width).toBeCloseTo(slot.h * portrait.height, 5)
  })
  it('returns zero for empty images', () => {
    expect(fitWidth(0, 10, slot, portrait)).toBe(0)
  })
})

describe('cards', () => {
  it('places a card centred in its slot', () => {
    const slot = defaultSlots('portrait')[0]
    const card = placeInSlot(1600, 1000, slot, portrait)
    expect(card.cx).toBeCloseTo(slot.x + slot.w / 2)
    expect(card.cy).toBeCloseTo(slot.y + slot.h / 2)
    expect(card.rotation).toBe(0)
  })
  it('hit tests the rotated rectangle', () => {
    const card = { cx: 0.5, cy: 0.5, width: 0.4, rotation: 0 }
    const px = cardPixels(card, 2000, 1000, portrait)
    expect(hitTest(px.cx, px.cy, card, 2000, 1000, portrait)).toBe(true)
    expect(hitTest(px.cx + px.width / 2 + 2, px.cy, card, 2000, 1000, portrait)).toBe(false)
    const turned = rotateCard(card, 90)
    expect(hitTest(px.cx, px.cy + px.width / 2 - 2, turned, 2000, 1000, portrait)).toBe(true)
    expect(hitTest(px.cx + px.width / 2 - 2, px.cy, turned, 2000, 1000, portrait)).toBe(false)
  })
  it('moves in page fractions and clamps to the page', () => {
    const card = { cx: 0.5, cy: 0.5, width: 0.4, rotation: 0 }
    expect(moveCard(card, 100, 0, portrait).cx).toBeCloseTo(0.6)
    expect(moveCard(card, 5000, 5000, portrait)).toMatchObject({ cx: 1, cy: 1 })
  })
  it('scales within limits and wraps rotation', () => {
    expect(scaleCard({ cx: 0, cy: 0, width: 1.4, rotation: 0 }, 2).width).toBe(1.5)
    expect(scaleCard({ cx: 0, cy: 0, width: 0.06, rotation: 0 }, 0.1).width).toBe(0.05)
    expect(rotateCard({ cx: 0, cy: 0, width: 1, rotation: 270 }, 180).rotation).toBe(90)
    expect(rotateCard({ cx: 0, cy: 0, width: 1, rotation: 0 }, -90).rotation).toBe(270)
  })
})
