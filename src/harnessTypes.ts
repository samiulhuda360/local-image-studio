// Types shared between the dev-only browser harness and the eval scripts.
import type { Box, DescribeResult, EncodeOptions } from './lib/types.ts'

export interface ProcessResult {
  bytes: number
  width: number
  height: number
  outWidth: number
  outHeight: number
}

export interface AnalyseResult {
  width: number
  height: number
  localAlt: string
  localCrop: Box
}

export interface HarnessDescribeResult extends DescribeResult {
  aiCrop: Box | null
}

export interface StudioHarness {
  process(base64: string, mime: string, name: string, opts: EncodeOptions): Promise<ProcessResult>
  analyse(base64: string, mime: string, name: string, aspect: number): Promise<AnalyseResult>
  describe(base64: string, mime: string, name: string, aspect: number): Promise<HarnessDescribeResult>
}

export interface StudioWindow {
  __studio?: StudioHarness
}
