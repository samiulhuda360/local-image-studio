import { useEffect, useMemo, useState } from 'react'
import { Dropzone } from './Dropzone.tsx'
import { describeImage } from '../lib/aiClient.ts'
import { dominantColour, fallbackAltText } from '../lib/altText.ts'
import { ASPECTS, cropAroundSubject, saliencyGrid, suggestCrop, type Saliency } from '../lib/crop.ts'
import { formatBytes, outputFileName } from '../lib/format.ts'
import { downloadBlob, loadImage, previewDataUrl, resizeAndEncode, samplePixels, type LoadedImage } from '../lib/imageOps.ts'
import type { Box, DescribeResult } from '../lib/types.ts'

interface Props {
  aiEnabled: boolean
  model: string
}

interface Loaded {
  file: File
  image: LoadedImage
  url: string
  saliency: Saliency
  localAlt: string
}

export function DescribeTool({ aiEnabled, model }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [aspectName, setAspectName] = useState('Square')
  const [ai, setAi] = useState<DescribeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [useAiCrop, setUseAiCrop] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => () => void (loaded && URL.revokeObjectURL(loaded.url)), [loaded])

  const addFile = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const image = await loadImage(file)
    const pixels = samplePixels(image)
    setLoaded({
      file,
      image,
      url: URL.createObjectURL(file),
      saliency: saliencyGrid(pixels.data, pixels.width, pixels.height),
      localAlt: fallbackAltText({
        fileName: file.name,
        width: image.width,
        height: image.height,
        colour: dominantColour(pixels.data),
      }),
    })
    setAi(null)
    setCopied(false)
  }

  const aspect = ASPECTS[aspectName] ?? 1
  const localCrop = useMemo<Box | null>(
    () => (loaded ? suggestCrop(loaded.saliency, loaded.image.width, loaded.image.height, aspect) : null),
    [loaded, aspect],
  )
  const aiCrop = useMemo<Box | null>(
    () => (loaded && ai?.subject ? cropAroundSubject(ai.subject, loaded.image.width, loaded.image.height, aspect) : null),
    [loaded, ai, aspect],
  )
  const crop = useAiCrop && aiCrop ? aiCrop : localCrop
  const cropIsAi = useAiCrop && aiCrop !== null

  const askAi = async () => {
    if (!loaded) return
    setBusy(true)
    try {
      const preview = await previewDataUrl(loaded.image)
      setAi(await describeImage(preview, loaded.file.name))
    } finally {
      setBusy(false)
    }
  }

  const altText = ai && ai.alt ? ai.alt : (loaded?.localAlt ?? '')

  const copyAlt = async () => {
    await navigator.clipboard.writeText(altText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadCrop = async () => {
    if (!loaded || !crop) return
    const blob = await resizeAndEncode(loaded.image, { format: 'image/jpeg', quality: 0.9, maxSide: 0 }, crop)
    downloadBlob(blob, outputFileName(loaded.file.name, 'image/jpeg', `-${aspectName.toLowerCase()}`))
  }

  return (
    <div className="panel two">
      <div className="card">
        <h2>Describe and crop</h2>
        <Dropzone label="Choose a photo" onFiles={(f) => void addFile(f)} />
        {loaded && (
          <p className="hint">
            {loaded.file.name}: {loaded.image.width} x {loaded.image.height} px, {formatBytes(loaded.file.size)}
          </p>
        )}

        <h3>Crop</h3>
        <div className="field">
          <label>Aspect ratio</label>
          <select value={aspectName} onChange={(e) => setAspectName(e.target.value)} aria-label="Aspect ratio">
            {Object.keys(ASPECTS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        {aiCrop && (
          <div className="segmented" role="group" aria-label="Crop source" style={{ marginBottom: 12 }}>
            <button aria-pressed={useAiCrop} onClick={() => setUseAiCrop(true)}>
              AI subject
            </button>
            <button aria-pressed={!useAiCrop} onClick={() => setUseAiCrop(false)}>
              Local detail
            </button>
          </div>
        )}
        <div className="row">
          <button className="btn" disabled={!crop} onClick={() => void downloadCrop()}>
            Download crop
          </button>
        </div>

        <h3>AI step</h3>
        <button className="btn primary" disabled={!loaded || !aiEnabled || busy} onClick={() => void askAi()}>
          {busy ? 'Asking the model...' : 'Write alt text with AI'}
        </button>
        <p className="hint">
          {aiEnabled
            ? `Sends a 768 px preview to ${model} through the local server route. Replies are cached on disk.`
            : 'No AI_API_KEY is set, so the description below is built locally from the file name, size and colours.'}
        </p>
      </div>

      <div className="card">
        <h2>Result</h2>
        {!loaded && <p className="hint">Choose a photo to see a suggested crop and alt text.</p>}
        {loaded && crop && (
          <>
            <div className="preview-wrap">
              <img src={loaded.url} alt={altText} />
              <div
                className={`crop-box${cropIsAi ? ' ai' : ''}`}
                data-testid="crop-box"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              />
            </div>
            <p className="hint">
              {cropIsAi
                ? 'Crop framed around the subject the model found.'
                : 'Crop framed around the most detailed area, found locally from contrast and colour.'}
            </p>
            <div className="alt-block" style={{ marginTop: 12 }}>
              <span className={`source${ai?.source === 'ai' || ai?.source === 'cache' ? '' : ' fallback'}`}>
                {ai?.source === 'ai' ? `AI (${ai.model})` : ai?.source === 'cache' ? 'AI (cached)' : 'Local fallback'}
              </span>
              <div data-testid="alt-text">{altText}</div>
              {ai?.caption && ai.caption !== ai.alt && (
                <div style={{ marginTop: 8, color: 'var(--muted)' }}>{ai.caption}</div>
              )}
              {ai?.source === 'fallback' && ai.reason && <div className="hint">{ai.reason}</div>}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn small" onClick={() => void copyAlt()}>
                  {copied ? 'Copied' : 'Copy alt text'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
