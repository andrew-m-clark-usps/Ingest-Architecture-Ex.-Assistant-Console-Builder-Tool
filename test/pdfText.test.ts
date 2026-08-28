import { test } from 'vitest'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { readPdf } from '../src/pdfText.js'

function obj(num: number, dict: string, streamText?: string): string {
  if (streamText === undefined) return `${num} 0 obj\n<< ${dict} >>\nendobj\n`
  const deflated = deflateSync(Buffer.from(streamText, 'latin1'))
  return (
    `${num} 0 obj\n<< ${dict} /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n` +
    deflated.toString('latin1') +
    `\nendstream\nendobj\n`
  )
}

/** Builds a minimal, real single-page PDF with no xref table (this reader scans for objects). */
function buildPdf(opts: { contentOps: string; toUnicodeCMap?: string }): Buffer {
  const parts: string[] = ['%PDF-1.4\n']
  const fontDict = opts.toUnicodeCMap
    ? '/Type /Font /Subtype /Type0 /ToUnicode 4 0 R'
    : '/Type /Font /Subtype /Type1'
  parts.push(obj(1, '/Type /Page /Contents 2 0 R /Resources << /Font << /F1 3 0 R >> >>'))
  parts.push(obj(2, '', opts.contentOps))
  parts.push(obj(3, fontDict))
  if (opts.toUnicodeCMap) parts.push(obj(4, '', opts.toUnicodeCMap))
  parts.push('%%EOF\n')
  return Buffer.from(parts.join(''), 'latin1')
}

test('extracts plain text from a Tj operator on one line', async () => {
  const pdf = buildPdf({ contentOps: 'BT /F1 12 Tf 100 700 Td (Hello World) Tj ET' })
  const pages = await readPdf(new Uint8Array(pdf))
  assert.equal(pages.length, 1)
  assert.equal(pages[0].page, 1)
  assert.ok(pages[0].lines.some((l) => l.includes('Hello') && l.includes('World')))
})

test('applies a /ToUnicode CMap when decoding a show string', async () => {
  // Byte 0x41 ('A') -> 'Z', byte 0x42 ('B') -> 'Y' — proves the CMap is
  // actually consulted, not just passed through as literal ASCII. Enough
  // text is shown to clear the "almost no text" scan-refusal guard.
  const cmap = '2 beginbfchar\n<41> <005A>\n<42> <0059>\nendbfchar'
  const pdf = buildPdf({
    contentOps: 'BT /F1 12 Tf 100 700 Td (ABABABABAB) Tj ET',
    toUnicodeCMap: cmap,
  })
  const pages = await readPdf(new Uint8Array(pdf))
  assert.ok(pages[0].lines.some((l) => l.includes('ZYZYZYZYZY')))
})

test('reconstructs one line from two separately-positioned runs with a space between them', async () => {
  const pdf = buildPdf({
    contentOps: 'BT /F1 12 Tf 100 700 Td (March) Tj 40 0 Td (2026) Tj ET',
  })
  const pages = await readPdf(new Uint8Array(pdf))
  assert.ok(pages[0].lines.some((l) => l === 'March 2026' || l.replace(/\s+/g, ' ') === 'March 2026'))
})

test('refuses a PDF with almost no extractable text (scan guard)', async () => {
  const pdf = buildPdf({ contentOps: 'BT /F1 12 Tf 100 700 Td (X) Tj ET' })
  await assert.rejects(() => readPdf(new Uint8Array(pdf)), /scan/i)
})
