import type { DescribeResult } from './types.ts'

export interface AiStatus {
  aiEnabled: boolean
  model: string
}

export async function fetchStatus(): Promise<AiStatus> {
  try {
    const res = await fetch('/api/status')
    if (!res.ok) return { aiEnabled: false, model: '' }
    return (await res.json()) as AiStatus
  } catch {
    return { aiEnabled: false, model: '' }
  }
}

/** Asks the local server route to describe a small preview. Resolves to a fallback result when no key is set. */
export async function describeImage(previewDataUrl: string, fileName: string): Promise<DescribeResult> {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: previewDataUrl, fileName }),
  })
  if (!res.ok) {
    return { alt: '', caption: '', subject: null, source: 'fallback', reason: `Server replied ${res.status}` }
  }
  return (await res.json()) as DescribeResult
}
