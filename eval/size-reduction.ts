// Measures how much smaller the "Resize and convert" presets make real photos.
//   npm run eval:size [-- <folder> ...]   (default: eval/photos)
// Writes eval/results/size-reduction.md and .json.
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { formatKb, MIME, readImage, startHarness } from './harness.ts'
import type { StudioWindow } from './harness.ts'

declare const window: StudioWindow

interface Preset {
  name: string
  maxSide: number
  format: 'image/jpeg' | 'image/png' | 'image/webp'
  quality: number
}

const PRESETS: Preset[] = [
  { name: 'Web 1600 px WebP q80', maxSide: 1600, format: 'image/webp', quality: 0.8 },
  { name: 'Email 1200 px JPEG q80', maxSide: 1200, format: 'image/jpeg', quality: 0.8 },
  { name: 'Same size WebP q85', maxSide: 0, format: 'image/webp', quality: 0.85 },
]

function listImages(dirs: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (MIME[path.extname(entry).toLowerCase()]) out.push(full)
    }
  }
  dirs.forEach(walk)
  return out.sort()
}

// Defaults to the committed public-domain photo set.
const args = process.argv.slice(2)
const dirs = args.length ? args : ['eval/photos']
const files = listImages(dirs)
if (!files.length) {
  console.error('No images found.')
  process.exit(1)
}

const harness = await startHarness()
try {
  const rows: { file: string; width: number; height: number; before: number; after: Record<string, { bytes: number; width: number; height: number }> }[] = []
  for (const file of files) {
    const img = readImage(file)
    const after: (typeof rows)[number]['after'] = {}
    let width = 0
    let height = 0
    for (const preset of PRESETS) {
      const r = await harness.page.evaluate(
        ({ base64, mime, name, opts }) => window.__studio!.process(base64, mime, name, opts),
        { base64: img.base64, mime: img.mime, name: img.name, opts: { maxSide: preset.maxSide, format: preset.format, quality: preset.quality } },
      )
      width = r.width
      height = r.height
      after[preset.name] = { bytes: r.bytes, width: r.outWidth, height: r.outHeight }
    }
    rows.push({ file: path.relative(process.cwd(), file), width, height, before: img.bytes, after })
    console.log(`${img.name}: ${formatKb(img.bytes)} -> ${PRESETS.map((p) => formatKb(after[p.name]?.bytes ?? 0)).join(' / ')}`)
  }

  const totalBefore = rows.reduce((n, r) => n + r.before, 0)
  const summary = PRESETS.map((p) => {
    const totalAfter = rows.reduce((n, r) => n + (r.after[p.name]?.bytes ?? 0), 0)
    const perImage = rows.map((r) => 1 - (r.after[p.name]?.bytes ?? 0) / r.before)
    return {
      preset: p.name,
      totalBefore,
      totalAfter,
      totalSaved: 1 - totalAfter / totalBefore,
      medianSaved: perImage.sort((a, b) => a - b)[Math.floor(perImage.length / 2)] ?? 0,
      minSaved: Math.min(...perImage),
    }
  })

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const lines = [
    `# Output size reduction`,
    ``,
    `${rows.length} images, ${formatKb(totalBefore)} in total. Measured with \`npm run eval:size\` on ${new Date().toISOString().slice(0, 10)}.`,
    ``,
    `| Preset | Total after | Total saved | Median saved | Smallest saving |`,
    `|---|---:|---:|---:|---:|`,
    ...summary.map((s) => `| ${s.preset} | ${formatKb(s.totalAfter)} | ${pct(s.totalSaved)} | ${pct(s.medianSaved)} | ${pct(s.minSaved)} |`),
    ``,
    `## Per image`,
    ``,
    `| File | Pixels | Before | ${PRESETS.map((p) => p.name).join(' | ')} |`,
    `|---|---|---:|${PRESETS.map(() => '---:').join('|')}|`,
    ...rows.map(
      (r) =>
        `| ${path.basename(r.file)} | ${r.width}x${r.height} | ${formatKb(r.before)} | ${PRESETS.map((p) => {
          const a = r.after[p.name]
          return a ? `${formatKb(a.bytes)} (${pct(1 - a.bytes / r.before)})` : '-'
        }).join(' | ')} |`,
    ),
    ``,
  ]
  mkdirSync('eval/results', { recursive: true })
  writeFileSync('eval/results/size-reduction.md', lines.join('\n'))
  writeFileSync('eval/results/size-reduction.json', JSON.stringify({ presets: PRESETS, summary, rows }, null, 2))
  console.log('\n' + lines.slice(0, 8).join('\n'))
  console.log('\nWritten to eval/results/size-reduction.md')
} finally {
  await harness.close()
}
