import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mapTesseractResult } from '../ocr/mapResult.mjs'

// Pure mapping logic — testable without tesseract.js or a real OCR run
// (see ocr/README.md for why the live engine could not be verified here).

test('maps tesseract.js confidence (0-100) to the 0..1 scale imageReader.ts expects', () => {
  const [line] = mapTesseractResult({
    lines: [{ text: 'Business Name', confidence: 92.5, bbox: { x0: 10, y0: 20, x1: 110, y1: 40 } }],
  })
  assert.equal(line.confidence, 0.925)
})

test('trims the recognized text', () => {
  const [line] = mapTesseractResult({ lines: [{ text: '  Business Name  ', confidence: 90, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }] })
  assert.equal(line.text, 'Business Name')
})

test('converts a bounding box into a region with width/height', () => {
  const [line] = mapTesseractResult({
    lines: [{ text: 'X', confidence: 90, bbox: { x0: 10, y0: 20, x1: 60, y1: 45 } }],
  })
  assert.deepEqual(line.region, { x: 10, y: 20, width: 50, height: 25 })
})

test('an absent lines array maps to an empty result rather than throwing', () => {
  assert.deepEqual(mapTesseractResult({}), [])
})
