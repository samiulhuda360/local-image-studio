// Scores alt text against the labelled set in eval/labels.json: the local
// fallback always runs; the model runs only when AI_API_KEY is set.
//   AI_API_KEY="$GEMINI_API_KEY" npm run eval:alt
// Writes eval/results/alt-text.md and .json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { readImage, startHarness } from './harness.ts'
import type { StudioWindow } from './harness.ts'

declare const window: StudioWindow

interface Item {
  file: string
  groups: string[][]
}

interface Labels {
  items: Item[]
}

function hits(alt: string, groups: string[][]): { pass: boolean; matched: number } {
  const text = alt.toLowerCase()
  const matched = groups.filter((g) => g.some((w) => text.includes(w.toLowerCase()))).length
  return { pass: matched === groups.length, matched }
}

const labels = JSON.parse(readFileSync('eval/labels.json', 'utf8')) as Labels
const items = labels.items.filter((i) => existsSync(i.file))
const skipped = labels.items.length - items.length
if (!items.length) {
  console.error('No labelled images found. Run `npm run eval:samples` first.')
  process.exit(1)
}
const aiEnabled = Boolean(process.env.AI_API_KEY)

const harness = await startHarness()
try {
  const rows: { file: string; localAlt: string; localPass: boolean; aiAlt: string | null; aiPass: boolean | null; aiSource: string | null; aiCrop: boolean }[] = []
  for (const item of items) {
    const img = readImage(item.file)
    const local = await harness.page.evaluate(
      ({ base64, mime, name }) => window.__studio!.analyse(base64, mime, name, 1),
      { base64: img.base64, mime: img.mime, name: img.name },
    )
    const localHit = hits(local.localAlt, item.groups)
    let aiAlt: string | null = null
    let aiPass: boolean | null = null
    let aiSource: string | null = null
    let aiCrop = false
    if (aiEnabled) {
      const ai = await harness.page.evaluate(
        ({ base64, mime, name }) => window.__studio!.describe(base64, mime, name, 1),
        { base64: img.base64, mime: img.mime, name: img.name },
      )
      aiSource = ai.source
      aiAlt = ai.alt || `(fallback: ${ai.reason ?? 'no reply'})`
      aiPass = ai.alt ? hits(ai.alt, item.groups).pass : false
      aiCrop = ai.aiCrop !== null
    }
    rows.push({ file: path.basename(item.file), localAlt: local.localAlt, localPass: localHit.pass, aiAlt, aiPass, aiSource, aiCrop })
    console.log(`${path.basename(item.file)}: local ${localHit.pass ? 'pass' : 'miss'}${aiEnabled ? `, ai ${aiPass ? 'pass' : 'miss'} (${aiSource})` : ''}`)
  }

  const n = rows.length
  const localPasses = rows.filter((r) => r.localPass).length
  const aiPasses = rows.filter((r) => r.aiPass).length
  const aiCrops = rows.filter((r) => r.aiCrop).length
  const pct = (k: number) => `${k}/${n} (${((k / n) * 100).toFixed(0)}%)`
  const lines = [
    `# Alt-text quality`,
    ``,
    `${n} labelled images${skipped ? ` (${skipped} skipped because the file is not on this machine)` : ''}. An item passes when the alt text names every labelled group. Measured with \`npm run eval:alt\` on ${new Date().toISOString().slice(0, 10)}.`,
    ``,
    `| Method | Items passing |`,
    `|---|---:|`,
    `| Local fallback (file name, size, colour) | ${pct(localPasses)} |`,
    aiEnabled ? `| AI (${process.env.AI_MODEL || 'gemini-flash-lite-latest'}) | ${pct(aiPasses)} |` : `| AI | not run (no AI_API_KEY) |`,
    ...(aiEnabled ? [``, `The model returned a subject box for ${aiCrops} of ${n} images, so those get a subject-anchored crop.`] : []),
    ``,
    `## Per image`,
    ``,
    `| File | Local alt | Local | AI alt | AI |`,
    `|---|---|:-:|---|:-:|`,
    ...rows.map((r) => `| ${r.file} | ${r.localAlt} | ${r.localPass ? 'pass' : 'miss'} | ${r.aiAlt ?? '-'} | ${r.aiPass === null ? '-' : r.aiPass ? 'pass' : 'miss'} |`),
    ``,
  ]
  mkdirSync('eval/results', { recursive: true })
  writeFileSync('eval/results/alt-text.md', lines.join('\n'))
  writeFileSync('eval/results/alt-text.json', JSON.stringify({ aiEnabled, localPasses, aiPasses, n, rows }, null, 2))
  console.log('\n' + lines.slice(0, 9).join('\n'))
  console.log('\nWritten to eval/results/alt-text.md')
} finally {
  await harness.close()
}
