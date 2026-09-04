import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { classifyLines } from './specExtract.js'
import type { Candidate } from './profiles/types.js'

export interface OcrEngine {
  id: string
  extractLines(input: { bytes: Uint8Array; refBase: string; extension: string; sourcePath?: string }): Promise<string[]>
}

export type OcrMode = 'off' | 'sidecar' | 'tesseract'

export interface OcrEnvironmentConfig {
  mode: OcrMode
  engineId?: string
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

function parseMode(value: string | undefined): OcrMode {
  const normalized = (value ?? 'off').trim().toLowerCase()
  if (normalized === 'off' || normalized === '') return 'off'
  if (normalized === 'sidecar') return 'sidecar'
  if (normalized === 'tesseract') return 'tesseract'
  throw new Error(`refused: unknown OCR mode "${value}" (use off|sidecar|tesseract)`)
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/)
}

async function readFirstExisting(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    try {
      return await readFile(path, 'utf-8')
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : undefined
      if (code !== 'ENOENT') throw err
    }
  }
  return undefined
}

function sidecarPaths(sourcePath: string): string[] {
  const extension = extname(sourcePath)
  const withoutExtension = extension.length > 0 ? sourcePath.slice(0, sourcePath.length - extension.length) : sourcePath
  return [`${sourcePath}.ocr.txt`, `${withoutExtension}.ocr.txt`]
}

function createSidecarEngine(): OcrEngine {
  return {
    id: 'sidecar',
    async extractLines(input) {
      if (!input.sourcePath) {
        throw new Error('sidecar OCR requires a sourcePath')
      }
      const sidecar = await readFirstExisting(sidecarPaths(input.sourcePath))
      if (sidecar === undefined) {
        throw new Error(`missing OCR sidecar (.ocr.txt) for ${input.sourcePath}`)
      }
      return splitLines(sidecar)
    },
  }
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })
    child.on('error', (err) => {
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`process exited with code ${code}: ${stderr.trim()}`))
      }
    })
  })
}

function createTesseractEngine(command: string, language: string): OcrEngine {
  return {
    id: 'tesseract',
    async extractLines(input) {
      const dir = await mkdtemp(join(tmpdir(), 'spec-ingest-ocr-'))
      const inPath = join(dir, `image${input.extension || '.img'}`)
      const outBase = join(dir, 'ocr-output')
      try {
        await writeFile(inPath, input.bytes)
        await runCommand(command, [inPath, outBase, '-l', language, 'txt'])
        const text = await readFile(`${outBase}.txt`, 'utf-8')
        return splitLines(text)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    },
  }
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

export function configureOcrFromEnvironment(env: NodeJS.ProcessEnv = process.env): OcrEnvironmentConfig {
  const mode = parseMode(env.SPEC_INGEST_OCR_MODE)
  if (mode === 'off') {
    clearOcrEngine()
    return { mode }
  }
  if (mode === 'sidecar') {
    setOcrEngine(createSidecarEngine())
    return { mode, engineId: getOcrEngineId() }
  }

  const command = env.SPEC_INGEST_TESSERACT_CMD ?? 'tesseract'
  const language = env.SPEC_INGEST_TESSERACT_LANG ?? 'eng'
  setOcrEngine(createTesseractEngine(command, language))
  return { mode, engineId: getOcrEngineId() }
}

export function isImageDocument(pathOrExtension: string): boolean {
  return IMAGE_EXTENSIONS.has(normalizeExtension(pathOrExtension))
}

export async function readImageCandidates(bytes: Uint8Array, refBase: string, options?: { sourcePath?: string }): Promise<Candidate[] | undefined> {
  const extension = normalizeExtension(refBase)
  if (!IMAGE_EXTENSIONS.has(extension)) return undefined

  if (!activeOcrEngine) {
    throw new Error(`refused: ${refBase} -- image OCR is not configured (pluggable seam only)`)
  }

  try {
    const lines = await activeOcrEngine.extractLines({ bytes, refBase, extension, sourcePath: options?.sourcePath })
    if (!Array.isArray(lines)) throw new Error('OCR engine returned a non-array result')
    return classifyLines(normalizeLines(lines), `${refBase}#ocr`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`refused: ${refBase} -- OCR failed via engine "${activeOcrEngine.id}": ${message}`)
  }
}
