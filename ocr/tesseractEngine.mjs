// A real, pinned, local OCR engine implementing the OcrEngine shape from
// ../src/imageReader.ts: { name, version, checksum?, recognize(bytes) }.
// See Spec-Ingest-Tool.md section 7A: "A local ML model ... runs offline
// from a file in the repository or a pinned package, with its version and
// checksum recorded in the audit log beside every candidate it produced."
//
// tesseract.js is pinned to an EXACT version in package.json (no ^) since
// "the same bytes give the same text every run" depends on it. For a
// genuinely offline deployment, pass `langPath` to a pre-downloaded
// `eng.traineddata` file and its `checksum` (e.g. sha256) — otherwise
// tesseract.js fetches the trained-data file from a CDN on first use,
// which this sandboxed environment could not reach (see README.md).

import { createWorker } from 'tesseract.js'
import { mapTesseractResult } from './mapResult.mjs'

const ENGINE_NAME = 'tesseract.js'
const ENGINE_VERSION = '5.1.1'

export function createTesseractEngine({ lang = 'eng', langPath, checksum } = {}) {
  let workerPromise

  async function getWorker() {
    if (!workerPromise) {
      const options = langPath ? { langPath, cachePath: langPath, gzip: false } : {}
      workerPromise = createWorker(lang, 1, options)
    }
    return workerPromise
  }

  return {
    name: ENGINE_NAME,
    version: ENGINE_VERSION,
    checksum,
    async recognize(bytes) {
      const worker = await getWorker()
      const { data } = await worker.recognize(Buffer.from(bytes))
      return mapTesseractResult(data)
    },
    async dispose() {
      if (workerPromise) await (await workerPromise).terminate()
    },
  }
}
