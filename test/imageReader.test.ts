import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readImage, NO_OCR_ENGINE, type OcrEngine } from '../src/imageReader.js'

const fakeEngine: OcrEngine = {
  name: 'fake-ocr',
  version: '1.0.0',
  async recognize() {
    return [
      { text: 'Business Name', confidence: 0.95, region: { x: 0, y: 0, width: 100, height: 20 } },
      { text: '5-year term', confidence: 0.9, region: { x: 0, y: 30, width: 100, height: 20 } },
      { text: 'blurry section', confidence: 0.3, region: { x: 0, y: 60, width: 100, height: 20 } },
    ]
  },
}

test('every OCR candidate names the engine and version, per the audit-log rule', async () => {
  const candidates = await readImage(new Uint8Array(), fakeEngine, 'photo.jpg')
  for (const c of candidates) {
    assert.match(c.because, /fake-ocr v1\.0\.0/)
  }
})

test('a low-confidence line is flagged for review', async () => {
  const candidates = await readImage(new Uint8Array(), fakeEngine, 'photo.jpg')
  const blurry = candidates.find((c) => c.text === 'blurry section')!
  assert.equal(blurry.needsReview, true)
})

test('a digit/unit/version is flagged for review regardless of confidence', async () => {
  const candidates = await readImage(new Uint8Array(), fakeEngine, 'photo.jpg')
  const withDigits = candidates.find((c) => c.text === '5-year term')!
  assert.equal(withDigits.confidence, 0.9) // high confidence
  assert.equal(withDigits.needsReview, true) // flagged anyway, per section 5C
})

test('no OCR engine is configured by default, and it says so rather than silently returning nothing', async () => {
  await assert.rejects(() => NO_OCR_ENGINE.recognize(), /no OCR engine configured/)
})
