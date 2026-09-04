import { extname } from 'node:path'
import { classifyLines } from './specExtract.js'
import type { Candidate } from './profiles/types.js'

export interface OcrEngine {
  id: string
  extractLines(input: { bytes: Uint8Array; refBase: string; extension: string }): Promise<string[]>
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'])

let activeOcrEngine: OcrEngine | undefined

function normalizeExtension(pathOrExtension: string): string {
  if (pathOrExtension.startsWith('.')) return pathOrExtension.toLowerCase()
  return extname(pathOrExtension).toLowerCase()
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

export function setOcrEngine(engine: OcrEngine | undefined): void {
  activeOcrEngine = engine
}

export function clearOcrEngine(): void {
  activeOcrEngine = undefined
}

export function getOcrEngineId(): string | undefined {
  return activeOcrEngine?.id
}

export function isImageDocument(pathOrExtension: string): boolean {
  return IMAGE_EXTENSIONS.has(normalizeExtension(pathOrExtension))
}

export async function readImageCandidates(bytes: Uint8Array, refBase: string): Promise<Candidate[] | undefined> {
  const extension = normalizeExtension(refBase)
  if (!IMAGE_EXTENSIONS.has(extension)) return undefined

  if (!activeOcrEngine) {
    throw new Error(`refused: ${refBase} -- image OCR is not configured (pluggable seam only)`)
  }

  try {
    const lines = await activeOcrEngine.extractLines({ bytes, refBase, extension })
    if (!Array.isArray(lines)) throw new Error('OCR engine returned a non-array result')
    return classifyLines(normalizeLines(lines), `${refBase}#ocr`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`refused: ${refBase} -- OCR failed via engine "${activeOcrEngine.id}": ${message}`)
  }
}
