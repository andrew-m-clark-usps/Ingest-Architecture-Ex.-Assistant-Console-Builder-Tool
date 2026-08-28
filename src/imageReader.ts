import type { Candidate, CandidateKind } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 5C ("Reading an image, a screenshot,
// or a photograph of a document"). OCR is transcription, not a model
// judgement about meaning — the line section 2/7A draws is "no model", and
// a pinned OCR engine with a pinned version is on the transcription side
// of it: the same bytes give the same text every run.
//
// This package ships with zero runtime dependencies (see section 2), so no
// OCR engine is bundled here. Callers inject a pinned engine that
// implements OcrEngine; its name and version are recorded in the audit log
// beside every candidate it produces, exactly as a real deployment must.

export interface OcrRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface OcrLine {
  text: string
  confidence: number // 0..1
  region: OcrRegion
}

export interface OcrEngine {
  readonly name: string
  readonly version: string
  recognize(bytes: Uint8Array): Promise<OcrLine[]>
}

export interface OcrCandidate extends Candidate {
  confidence: number
  region: OcrRegion
  needsReview: boolean
}

const DIGIT_UNIT_VERSION_RE = /\d|\bv\d|%|\$/i
const LOW_CONFIDENCE_THRESHOLD = 0.6

function classifyOcrLine(text: string): CandidateKind {
  if (/^[A-Z0-9][A-Z0-9 &/\-]{3,}$/.test(text) && text === text.toUpperCase()) return 'heading'
  if (/\d/.test(text)) return 'amount'
  return 'field'
}

/**
 * Transcribe an image via a pinned OCR engine. Every result is
 * lower-confidence than typed text and is a candidate, never a rule on its
 * own — it may corroborate or contradict another source once merged, but
 * this function alone never decides anything.
 */
export async function readImage(bytes: Uint8Array, engine: OcrEngine, ref: string): Promise<OcrCandidate[]> {
  const lines = await engine.recognize(bytes)
  return lines.map((line) => {
    const needsReview = line.confidence < LOW_CONFIDENCE_THRESHOLD || DIGIT_UNIT_VERSION_RE.test(line.text)
    return {
      kind: classifyOcrLine(line.text),
      text: line.text,
      ref,
      because: `OCR (${engine.name} v${engine.version}), confidence ${line.confidence.toFixed(2)}${
        needsReview ? ' — flagged for review' : ''
      }`,
      confidence: line.confidence,
      region: line.region,
      needsReview,
    }
  })
}

/**
 * No engine is configured by default (see the note above). Passing this
 * makes the "no OCR engine" gap explicit instead of silently returning
 * nothing, matching section 5C's refusal-over-guessing posture.
 */
export const NO_OCR_ENGINE: OcrEngine = {
  name: 'none',
  version: '0',
  async recognize(): Promise<OcrLine[]> {
    throw new Error(
      'no OCR engine configured — inject a pinned OcrEngine (name + version) per Spec-Ingest-Tool.md section 5C; this scaffold ships none, by the zero-runtime-dependency rule in section 2',
    )
  },
}
