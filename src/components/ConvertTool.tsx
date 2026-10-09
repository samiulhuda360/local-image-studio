import { useEffect, useMemo, useState } from 'react'
import { Dropzone } from './Dropzone.tsx'
import { downloadBlob, loadImage, resizeAndEncode, targetSize, type LoadedImage } from '../lib/imageOps.ts'
import { formatBytes, outputFileName, reductionPercent } from '../lib/format.ts'
import type { OutputFormat } from '../lib/types.ts'

interface Item {
  id: number
  file: File
  image: LoadedImage
  url: string
  output?: Blob
}

const PRESETS: Record<string, { maxSide: number; format: OutputFormat; quality: number }> = {
  'Web (1600 px, WebP)': { maxSide: 1600, format: 'image/webp', quality: 0.8 },
  'Email (1200 px, JPEG)': { maxSide: 1200, format: 'image/jpeg', quality: 0.8 },
  'Thumbnail (400 px, WebP)': { maxSide: 400, format: 'image/webp', quality: 0.75 },
  'Same size, WebP': { maxSide: 0, format: 'image/webp', quality: 0.85 },
}

let nextId = 1

export function ConvertTool() {
  const [items, setItems] = useState<Item[]>([])
  const [maxSide, setMaxSide] = useState(1600)
  const [format, setFormat] = useState<OutputFormat>('image/webp')
  const [quality, setQuality] = useState(0.8)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), [items])

  const addFiles = async (files: File[]) => {
    const loaded = await Promise.all(
      files.map(async (file) => ({ id: nextId++, file, image: await loadImage(file), url: URL.createObjectURL(file) })),
    )
    setItems((prev) => [...prev, ...loaded])
  }

  const convertAll = async () => {
    setBusy(true)
    try {
      for (const item of items) {
        const output = await resizeAndEncode(item.image, { maxSide, format, quality })
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, output } : p)))
      }
    } finally {
      setBusy(false)
    }
  }

  const applyPreset = (name: string) => {
    const p = PRESETS[name]
    if (!p) return
    setMaxSide(p.maxSide)
    setFormat(p.format)
    setQuality(p.quality)
  }

  const totals = useMemo(() => {
    const before = items.reduce((n, i) => n + i.file.size, 0)
    const done = items.filter((i) => i.output)
    const after = done.reduce((n, i) => n + (i.output?.size ?? 0), 0)
    const beforeDone = done.reduce((n, i) => n + i.file.size, 0)
    return { before, after, beforeDone, count: done.length }
  }, [items])

  const downloadAll = () => {
    items.forEach((i, idx) => {
      if (i.output) setTimeout(() => downloadBlob(i.output as Blob, outputFileName(i.file.name, format)), idx * 150)
    })
  }

  return (
    <div className="panel two">
      <div className="card">
        <h2>Settings</h2>
        <div className="field">
          <label>Preset</label>
          <select defaultValue="" onChange={(e) => applyPreset(e.target.value)} aria-label="Preset">
            <option value="" disabled>
              Choose a preset
            </option>
            {Object.keys(PRESETS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Longest side <span>{maxSide === 0 ? 'keep original' : `${maxSide} px`}</span>
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={maxSide}
            aria-label="Longest side in pixels"
            onChange={(e) => setMaxSide(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} aria-label="Format">
            <option value="image/webp">WebP</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
          </select>
        </div>
        <div className="field">
          <label>
            Quality <span>{format === 'image/png' ? 'lossless' : Math.round(quality * 100)}</span>
          </label>
          <input
            type="range"
            min={30}
            max={100}
            value={Math.round(quality * 100)}
            disabled={format === 'image/png'}
            aria-label="Quality"
            onChange={(e) => setQuality(Number(e.target.value) / 100)}
          />
        </div>
        <div className="row">
          <button className="btn primary" disabled={!items.length || busy} onClick={() => void convertAll()}>
            {busy ? 'Converting...' : `Convert ${items.length || ''} ${items.length === 1 ? 'image' : 'images'}`}
          </button>
          <button className="btn" disabled={!totals.count} onClick={downloadAll}>
            Download all
          </button>
          <button className="btn" disabled={!items.length} onClick={() => setItems([])}>
            Clear
          </button>
        </div>
        <p className="hint">
          Images are decoded, resized and re-encoded by your browser. Nothing is uploaded. Images are only ever shrunk,
          never enlarged.
        </p>
      </div>

      <div className="card">
        <h2>Images</h2>
        <Dropzone label="Add photos" hint="Drop several images or click to choose" multiple onFiles={(f) => void addFiles(f)} />
        {items.length > 0 && (
          <table className="results" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>File</th>
                <th>Output</th>
                <th className="num">Before</th>
                <th className="num">After</th>
                <th className="num">Saved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const out = targetSize(item.image.width, item.image.height, maxSide)
                const saved = item.output ? reductionPercent(item.file.size, item.output.size) : null
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="thumb" style={{ margin: 0, border: 'none', padding: 0, background: 'none' }}>
                        <img src={item.url} alt="" />
                        <div className="meta">
                          <div className="name">{item.file.name}</div>
                          <div className="sub">
                            {item.image.width} x {item.image.height}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {out.width} x {out.height}
                    </td>
                    <td className="num">{formatBytes(item.file.size)}</td>
                    <td className="num">{item.output ? formatBytes(item.output.size) : '-'}</td>
                    <td className={`num ${saved === null ? '' : saved >= 0 ? 'saved' : 'grew'}`}>
                      {saved === null ? '-' : `${saved}%`}
                    </td>
                    <td>
                      {item.output && (
                        <button
                          className="btn small"
                          onClick={() => downloadBlob(item.output as Blob, outputFileName(item.file.name, format))}
                        >
                          Download
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {totals.count > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>{totals.count} converted</td>
                  <td className="num">{formatBytes(totals.beforeDone)}</td>
                  <td className="num">{formatBytes(totals.after)}</td>
                  <td className="num saved">{reductionPercent(totals.beforeDone, totals.after)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
