import { describe, expect, it } from 'vitest'
import { baseName, formatBytes, humaniseFileName, outputFileName, reductionPercent } from '../src/lib/format.ts'

describe('formatBytes', () => {
  it('picks a sensible unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
  })
  it('never crashes on bad input', () => {
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('reductionPercent', () => {
  it('reports savings to one decimal', () => {
    expect(reductionPercent(1000, 250)).toBe(75)
    expect(reductionPercent(1000, 333)).toBe(66.7)
  })
  it('goes negative when the output grew and zero for an empty input', () => {
    expect(reductionPercent(100, 150)).toBe(-50)
    expect(reductionPercent(0, 10)).toBe(0)
  })
})

describe('file names', () => {
  it('strips paths and extensions', () => {
    expect(baseName('C:\\photos\\holiday.final.JPG')).toBe('holiday.final')
    expect(baseName('/a/b/noext')).toBe('noext')
    expect(baseName('.hidden')).toBe('.hidden')
  })
  it('builds output names with the right extension', () => {
    expect(outputFileName('holiday.png', 'image/webp')).toBe('holiday.webp')
    expect(outputFileName('holiday.png', 'image/jpeg', '-square')).toBe('holiday-square.jpg')
  })
  it('turns camera-style names into words', () => {
    expect(humaniseFileName('IMG_2024-01-03_beach day.JPG')).toBe('beach day')
    expect(humaniseFileName('DSC00123.jpg')).toBe('')
    expect(humaniseFileName('redCircleOnWhite.png')).toBe('red circle on white')
  })
})
