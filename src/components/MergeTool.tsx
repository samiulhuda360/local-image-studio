import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { Dropzone } from './Dropzone.tsx'
import { drawPage, exportPage, downloadBlob, loadImage, type LoadedImage, type PlacedCard } from '../lib/imageOps.ts'
import {
  defaultSlots,
  EXPORT_WIDTH,
  hitTest,
  moveCard,
  pageSize,
  placeInSlot,
  rotateCard,
  scaleCard,
  type Card,
} from '../lib/merge.ts'
import type { Orientation, OutputFormat } from '../lib/types.ts'
import { formatBytes } from '../lib/format.ts'

type Side = 0 | 1
const SIDE_NAMES = ['Front', 'Back'] as const
const DISPLAY_WIDTH: Record<Orientation, number> = { portrait: 520, landscape: 760 }

interface SideState {
  image: LoadedImage
  card: Card
}

export function MergeTool() {
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [sides, setSides] = useState<[SideState | null, SideState | null]>([null, null])
  const [selected, setSelected] = useState<Side>(0)
  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [guides, setGuides] = useState(true)
  const [exported, setExported] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ side: Side; lastX: number; lastY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const page = pageSize(DISPLAY_WIDTH[orientation], orientation)

  const setSide = useCallback(
    (side: Side, update: (s: SideState) => SideState) =>
      setSides((prev) => {
        const next: [SideState | null, SideState | null] = [prev[0], prev[1]]
        const current = next[side]
        if (current) next[side] = update(current)
        return next
      }),
    [],
  )

  const addImage = async (side: Side, files: File[]) => {
    const file = files[0]
    if (!file) return
    const image = await loadImage(file)
    const slot = defaultSlots(orientation)[side]
    setSides((prev) => {
      const next: [SideState | null, SideState | null] = [prev[0], prev[1]]
      next[side] = { image, card: placeInSlot(image.width, image.height, slot, page) }
      return next
    })
    setSelected(side)
  }

  const changeOrientation = (next: Orientation) => {
    setOrientation(next)
    const nextPage = pageSize(DISPLAY_WIDTH[next], next)
    const slots = defaultSlots(next)
    setSides((prev) => [
      prev[0] && { ...prev[0], card: placeInSlot(prev[0].image.width, prev[0].image.height, slots[0], nextPage) },
      prev[1] && { ...prev[1], card: placeInSlot(prev[1].image.width, prev[1].image.height, slots[1], nextPage) },
    ])
  }

  const placed = (): PlacedCard[] =>
    sides.flatMap((s) => (s ? [{ card: s.card, image: s.image }] : []))

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = Math.round(page.width)
    canvas.height = Math.round(page.height)
    drawPage(ctx, page.width, orientation, placed(), guides)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sides, orientation, guides, page.width, page.height])

  const canvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasPoint(e)
    for (const side of [1, 0] as Side[]) {
      const s = sides[side]
      if (s && hitTest(x, y, s.card, s.image.width, s.image.height, page)) {
        drag.current = { side, lastX: x, lastY: y }
        setSelected(side)
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const { x, y } = canvasPoint(e)
    const dx = x - d.lastX
    const dy = y - d.lastY
    d.lastX = x
    d.lastY = y
    setSide(d.side, (s) => ({ ...s, card: moveCard(s.card, dx, dy, page) }))
  }

  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    if (!sides[selected]) return
    const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05
    setSide(selected, (s) => ({ ...s, card: scaleCard(s.card, factor) }))
  }

  const doExport = async () => {
    const blob = await exportPage(orientation, placed(), format, 0.92, EXPORT_WIDTH[orientation])
    downloadBlob(blob, `id-card-${orientation}.${format === 'image/png' ? 'png' : 'jpg'}`)
    setExported(`${formatBytes(blob.size)} ${format === 'image/png' ? 'PNG' : 'JPEG'}, A4 at 300 dpi`)
  }

  const current = sides[selected]

  return (
    <div className="panel two">
      <div className="card">
        <h2>Front and back</h2>
        {SIDE_NAMES.map((name, i) => {
          const side = i as Side
          const s = sides[side]
          return (
            <div key={name} style={{ marginBottom: 10 }}>
              {s ? (
                <div className="thumb">
                  <div className="meta">
                    <div className="name">
                      {name}: {s.image.fileName}
                    </div>
                    <div className="sub">
                      {s.image.width} x {s.image.height} px, {formatBytes(s.image.bytes)}
                    </div>
                  </div>
                  <button
                    className="btn small"
                    onClick={() =>
                      setSides((prev) => {
                        const next: [SideState | null, SideState | null] = [prev[0], prev[1]]
                        next[side] = null
                        return next
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <Dropzone label={`${name} of the card`} onFiles={(files) => void addImage(side, files)} />
              )}
            </div>
          )
        })}

        <h3>Page</h3>
        <div className="segmented" role="group" aria-label="Orientation">
          {(['portrait', 'landscape'] as Orientation[]).map((o) => (
            <button key={o} aria-pressed={orientation === o} onClick={() => changeOrientation(o)}>
              {o === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
          ))}
        </div>

        <h3>Selected: {SIDE_NAMES[selected]}</h3>
        <div className="field">
          <label>
            Size <span>{current ? `${Math.round(current.card.width * 100)}% of page width` : '-'}</span>
          </label>
          <input
            type="range"
            min={5}
            max={120}
            value={current ? Math.round(current.card.width * 100) : 50}
            disabled={!current}
            aria-label="Card size"
            onChange={(e) =>
              setSide(selected, (s) => ({ ...s, card: { ...s.card, width: Number(e.target.value) / 100 } }))
            }
          />
        </div>
        <div className="row">
          <button
            className="btn small"
            disabled={!current}
            onClick={() => setSide(selected, (s) => ({ ...s, card: rotateCard(s.card, -90) }))}
          >
            Rotate left
          </button>
          <button
            className="btn small"
            disabled={!current}
            onClick={() => setSide(selected, (s) => ({ ...s, card: rotateCard(s.card, 90) }))}
          >
            Rotate right
          </button>
          <button
            className="btn small"
            disabled={!current}
            onClick={() =>
              setSide(selected, (s) => ({
                ...s,
                card: placeInSlot(s.image.width, s.image.height, defaultSlots(orientation)[selected], page),
              }))
            }
          >
            Reset
          </button>
        </div>
        <p className="hint">Drag a card to move it. Scroll over the page to resize the selected card.</p>

        <h3>Export</h3>
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}>
            <option value="image/jpeg">JPEG (smaller)</option>
            <option value="image/png">PNG (lossless)</option>
          </select>
        </div>
        <label className="row" style={{ fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show guides on
          screen
        </label>
        <button className="btn primary" disabled={!sides[0] && !sides[1]} onClick={() => void doExport()}>
          Download A4 page
        </button>
        {exported && <p className="hint">Saved: {exported}</p>}
      </div>

      <div className="card">
        <h2>Page preview</h2>
        <div className="stage">
          <canvas
            ref={canvasRef}
            className={dragging ? 'dragging' : ''}
            aria-label="Merged page preview"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          />
        </div>
      </div>
    </div>
  )
}
