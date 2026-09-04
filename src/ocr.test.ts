import { afterEach, describe, expect, it } from 'vitest'
import { clearOcrEngine, getOcrEngineId, isImageDocument, readImageCandidates, setOcrEngine } from './ocr.js'

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
})

describe('isImageDocument', () => {
  it('detects image extensions case-insensitively', () => {
    expect(isImageDocument('capture.PNG')).toBe(true)
    expect(isImageDocument('.jpeg')).toBe(true)
    expect(isImageDocument('manual.pdf')).toBe(false)
  })
})
