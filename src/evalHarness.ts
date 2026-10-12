// Dev-only bridge used by the scripts in eval/. It runs the exact functions the
// UI runs, inside a headless browser, so the measured numbers match the app.
import { describeImage } from './lib/aiClient.ts'
import { dominantColour, fallbackAltText } from './lib/altText.ts'
import { cropAroundSubject, saliencyGrid, suggestCrop } from './lib/crop.ts'
import { loadImage, previewDataUrl, resizeAndEncode, samplePixels } from './lib/imageOps.ts'

import type { StudioHarness } from './harnessTypes.ts'

declare global {
  interface Window {
    __studio?: StudioHarness
  }
}

function toFile(base64: string, mime: string, name: string): File {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

const harness: StudioHarness = {
  async process(base64, mime, name, opts) {
    const image = await loadImage(toFile(base64, mime, name))
    const blob = await resizeAndEncode(image, opts)
    const out = await createImageBitmap(blob)
    return { bytes: blob.size, width: image.width, height: image.height, outWidth: out.width, outHeight: out.height }
  },
  async analyse(base64, mime, name, aspect) {
    const image = await loadImage(toFile(base64, mime, name))
    const pixels = samplePixels(image)
    const sal = saliencyGrid(pixels.data, pixels.width, pixels.height)
    return {
      width: image.width,
      height: image.height,
      localAlt: fallbackAltText({ fileName: name, width: image.width, height: image.height, colour: dominantColour(pixels.data) }),
      localCrop: suggestCrop(sal, image.width, image.height, aspect),
    }
  },
  async describe(base64, mime, name, aspect) {
    const image = await loadImage(toFile(base64, mime, name))
    const result = await describeImage(await previewDataUrl(image), name)
    const aiCrop = result.subject ? cropAroundSubject(result.subject, image.width, image.height, aspect) : null
    return { ...result, aiCrop }
  },
}

window.__studio = harness
