import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { clearOcrEngine, configureOcrFromEnvironment, getOcrEngineId, isImageDocument, readImageCandidates, setOcrEngine } from './ocr.js'

afterEach(() => {
  clearOcrEngine()
})

describe('readImageCandidates', () => {
  it('returns undefined for non-image files', async () => {
    const candidates = await readImageCandidates(new TextEncoder().encode('hello'), 'notes.txt')
    expect(candidates).toBeUndefined()
  })

  it('refuses image reads when no OCR engine is configured', async () => {
    await expect(readImageCandidates(new Uint8Array([137, 80, 78, 71]), 'scan.png')).rejects.toThrow(/image OCR is not configured/i)
  })

  it('uses configured engine output and classifies OCR lines', async () => {
    setOcrEngine({
      id: 'fake-ocr',
      async extractLines() {
        return ['Account Number', 'Operator must sign each submission.']
      },
    })

    const candidates = await readImageCandidates(new Uint8Array([255, 216, 255]), 'photo.jpg')

    expect(getOcrEngineId()).toBe('fake-ocr')
    expect(candidates).toBeDefined()
    expect(candidates?.some((candidate) => candidate.kind === 'field' && candidate.text === 'Account Number')).toBe(true)
    expect(candidates?.some((candidate) => candidate.kind === 'rule' && candidate.text === 'Operator must sign each submission.')).toBe(true)
    expect(candidates?.every((candidate) => candidate.ref === 'photo.jpg#ocr')).toBe(true)
  })

  it('wraps OCR engine failures with engine context', async () => {
    setOcrEngine({
      id: 'broken-ocr',
      async extractLines() {
        throw new Error('binary unavailable')
      },
    })

    await expect(readImageCandidates(new Uint8Array([71, 73, 70]), 'diagram.gif')).rejects.toThrow(/OCR failed via engine "broken-ocr": binary unavailable/i)
  })

  it('reads OCR text from a sidecar transcript when sidecar mode is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spec-ingest-ocr-test-'))
    try {
      const imagePath = join(dir, 'capture.png')
      await writeFile(imagePath, new Uint8Array([137, 80, 78, 71]))
      await writeFile(`${imagePath}.ocr.txt`, 'Account Number\nThe operator must validate every upload.\n', 'utf-8')

      const configured = configureOcrFromEnvironment({ SPEC_INGEST_OCR_MODE: 'sidecar' })
      expect(configured.mode).toBe('sidecar')
      expect(configured.engineId).toBe('sidecar')

      const candidates = await readImageCandidates(new Uint8Array([137, 80, 78, 71]), 'capture.png', { sourcePath: imagePath })
      expect(candidates?.some((candidate) => candidate.kind === 'field' && candidate.text === 'Account Number')).toBe(true)
      expect(candidates?.some((candidate) => candidate.kind === 'rule' && candidate.text === 'The operator must validate every upload.')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('fails with a clear message when sidecar transcript is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spec-ingest-ocr-test-'))
    try {
      const imagePath = join(dir, 'capture.png')
      configureOcrFromEnvironment({ SPEC_INGEST_OCR_MODE: 'sidecar' })
      await expect(readImageCandidates(new Uint8Array([137, 80, 78, 71]), 'capture.png', { sourcePath: imagePath })).rejects.toThrow(
        /missing OCR sidecar/i,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('isImageDocument', () => {
  it('detects image extensions case-insensitively', () => {
    expect(isImageDocument('capture.PNG')).toBe(true)
    expect(isImageDocument('.jpeg')).toBe(true)
    expect(isImageDocument('manual.pdf')).toBe(false)
  })
})

describe('configureOcrFromEnvironment', () => {
  it('turns OCR off by default', () => {
    const configured = configureOcrFromEnvironment({})
    expect(configured.mode).toBe('off')
    expect(getOcrEngineId()).toBeUndefined()
  })

  it('configures tesseract mode with command and language overrides', () => {
    const configured = configureOcrFromEnvironment({
      SPEC_INGEST_OCR_MODE: 'tesseract',
      SPEC_INGEST_TESSERACT_CMD: 'my-tesseract',
      SPEC_INGEST_TESSERACT_LANG: 'eng',
    })
    expect(configured.mode).toBe('tesseract')
    expect(configured.engineId).toBe('tesseract')
  })

  it('rejects unsupported OCR mode values', () => {
    expect(() => configureOcrFromEnvironment({ SPEC_INGEST_OCR_MODE: 'magic' })).toThrow(/unknown OCR mode/i)
  })
})
