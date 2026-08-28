// Pure mapping from tesseract.js's raw recognition result to the
// OcrLine shape imageReader.ts expects (confidence 0..1, a region box).
// Split out so it can be unit tested without tesseract.js installed at
// the root of the repo (see ocr/README.md) — this file has zero
// dependencies of its own.

/** @param {{ lines?: Array<{ text: string, confidence: number, bbox: { x0: number, y0: number, x1: number, y1: number } }> }} data */
export function mapTesseractResult(data) {
  return (data.lines ?? []).map((line) => ({
    text: line.text.trim(),
    confidence: line.confidence / 100,
    region: {
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0,
    },
  }))
}
