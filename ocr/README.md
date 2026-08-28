# Local pinned OCR engine (Spec-Ingest-Tool.md section 5C/7A)

A real `OcrEngine` (see `../src/imageReader.ts`) backed by
[tesseract.js](https://github.com/naptha/tesseract.js), pinned to an
**exact** version (`5.1.1`, no `^`) — "the same bytes give the same text
every run" depends on the engine never silently moving.

Separate from the core `spec-ingest-tool` package, which ships with
**zero runtime dependencies**. Section 7A explicitly allows a local,
pinned ML model (an OCR engine, a sentence classifier) as long as it runs
offline and its version + checksum are recorded in the audit log beside
every candidate it produces — that's what this package is, kept out of the
core package's own dependency tree.

## Usage

```js
import { createTesseractEngine } from './tesseractEngine.mjs'
import { readImage } from '../src/imageReader.js'

const engine = createTesseractEngine({
  // For a genuinely offline run, point at a pre-downloaded traineddata
  // file and record its checksum:
  // langPath: '/path/to/traineddata-dir',
  // checksum: 'sha256:...',
})
const candidates = await readImage(imageBytes, engine, 'screenshot.png')
await engine.dispose()
```

## Known limitation — not independently verified end-to-end here

`npm install` succeeds in this sandboxed environment, but a real
recognition run fails: tesseract.js downloads its trained-data file
(`eng.traineddata.gz`) from `cdn.jsdelivr.net` on first use, and that CDN
could not be reached here (same corporate-proxy restriction that blocks
Playwright's Chromium download — see `../capture/README.md`).

What **is** verified:
- `npm install` resolves the pinned `tesseract.js@5.1.1` cleanly.
- The pure result-mapping logic (`mapResult.mjs` — tesseract.js's raw
  `{ text, confidence, bbox }` shape into the `OcrLine` shape
  `imageReader.ts` expects) is unit tested in
  `../test/ocrMapResult.test.ts` with **no** tesseract.js dependency, so it
  needed no network access to verify.
- `readImage()` in `imageReader.ts` (confidence threshold, digit/unit/
  version flagging, `because` message naming engine + version + checksum)
  is separately unit tested against a fake `OcrEngine` in
  `../test/imageReader.test.ts`.

What is **not** verified: an actual image recognized by the real
tesseract.js engine end to end. To confirm before relying on this in
production, either run once on a network that can reach
`cdn.jsdelivr.net`, or download `eng.traineddata` yourself, record its
checksum, and pass `langPath`/`checksum` as shown above.
