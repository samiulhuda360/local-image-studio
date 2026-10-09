import { describe, expect, it } from 'vitest'
import { colourName, dominantColour, fallbackAltText } from '../src/lib/altText.ts'

describe('colourName', () => {
  it('names the basics', () => {
    expect(colourName({ r: 220, g: 30, b: 30 })).toBe('red')
    expect(colourName({ r: 30, g: 60, b: 220 })).toBe('blue')
    expect(colourName({ r: 40, g: 180, b: 60 })).toBe('green')
    expect(colourName({ r: 250, g: 250, b: 250 })).toBe('white')
    expect(colourName({ r: 10, g: 10, b: 10 })).toBe('black')
    expect(colourName({ r: 128, g: 128, b: 128 })).toBe('grey')
    expect(colourName({ r: 230, g: 140, b: 30 })).toBe('orange')
    expect(colourName({ r: 110, g: 60, b: 20 })).toBe('brown')
    expect(colourName({ r: 40, g: 170, b: 180 })).toBe('teal')
  })
})

describe('dominantColour', () => {
  it('averages the sampled pixels', () => {
    const data = new Uint8ClampedArray(4 * 100)
    for (let i = 0; i < 100; i++) {
      data[i * 4] = 200
      data[i * 4 + 1] = 100
      data[i * 4 + 2] = 50
      data[i * 4 + 3] = 255
    }
    expect(dominantColour(data, 1)).toEqual({ r: 200, g: 100, b: 50 })
    expect(dominantColour(new Uint8ClampedArray(0))).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('fallbackAltText', () => {
  it('uses the file name when it says something', () => {
    const alt = fallbackAltText({ fileName: 'beach-sunset.jpg', width: 1920, height: 1080, colour: { r: 230, g: 140, b: 30 } })
    expect(alt).toBe('Image of beach sunset, landscape orientation, 1920 by 1080 pixels, mostly orange tones.')
  })
  it('stays honest when the name is just a camera number', () => {
    const alt = fallbackAltText({ fileName: 'DSC_0042.JPG', width: 800, height: 1200, colour: { r: 128, g: 128, b: 128 } })
    expect(alt).toBe('Image, portrait orientation, 800 by 1200 pixels, mostly grey tones.')
  })
  it('calls near-square images square', () => {
    expect(fallbackAltText({ fileName: 'x.png', width: 1000, height: 1100, colour: { r: 0, g: 0, b: 0 } })).toContain('square')
  })
})
