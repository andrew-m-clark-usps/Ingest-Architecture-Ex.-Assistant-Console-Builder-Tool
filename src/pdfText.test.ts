import { describe, expect, it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { readPdf } from './pdfText.js'

function buildPdf(contentStream: string, opts?: { flate?: boolean }): Uint8Array {
  const streamBytes = opts?.flate ? deflateSync(Buffer.from(contentStream, 'latin1')) : Buffer.from(contentStream, 'latin1')
  const filter = opts?.flate ? ' /Filter /FlateDecode' : ''
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamBytes.length}${filter} >>\nstream\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  const header = Buffer.from('%PDF-1.4\n', 'latin1')
  const part1 = Buffer.from(objects[0] + objects[1] + objects[2] + objects[3], 'latin1')
  const part2 = Buffer.from('\nendstream\nendobj\n' + objects[4] + 'trailer\n<< /Root 1 0 R >>\n%%EOF', 'latin1')
  return new Uint8Array(Buffer.concat([header, part1, streamBytes, part2]))
}

describe('readPdf', () => {
  it('extracts text shown with Tj inside a BT/ET block', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (Hello World) Tj ET')
    const pages = await readPdf(pdf)
    expect(pages).toHaveLength(1)
    expect(pages[0].lines.join(' ')).toContain('Hello World')
  })

  it('inserts a space for a large negative TJ gap between runs', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td [(Hello)-300(World)] TJ ET')
    const pages = await readPdf(pdf)
    expect(pages[0].lines.join(' ')).toContain('Hello World')
  })

  it('reads a FlateDecode-compressed content stream', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (Compressed content) Tj ET', { flate: true })
    const pages = await readPdf(pdf)
    expect(pages[0].lines.join(' ')).toContain('Compressed content')
  })

  it('starts a new line on T* / a vertical Td move', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (Line one) Tj T* (Line two) Tj ET')
    const pages = await readPdf(pdf)
    expect(pages[0].lines).toEqual(['Line one', 'Line two'])
  })

  it('refuses a document with near-zero text (scanned-document guard)', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (x) Tj ET')
    await expect(readPdf(pdf)).rejects.toThrow(/scanned document/)
  })

  it('refuses when more than ~40% of tokens are a single character (subsetted-font guard)', async () => {
    const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (a b c d e f g h) Tj ET')
    await expect(readPdf(pdf)).rejects.toThrow(/subsetted font/)
  })

  it('refuses a buffer with no PDF objects', async () => {
    await expect(readPdf(new TextEncoder().encode('not a pdf'))).rejects.toThrow(/no PDF objects/)
  })
})
