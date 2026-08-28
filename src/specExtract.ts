import type { Candidate } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 7 ("Classifying lines into
// candidates"). rule is found by normative language, a numbered line is a
// step, a short title-case line with no sentence punctuation is a field,
// and a line in capitals is a heading. Deduplicates repeated lines (a tech
// sheet repeats its header on every page) and returns an honest zero when
// a document yields nothing.

// The phrase recorded as `because` is whichever of these matched first;
// order matters only for that message, not for whether a line qualifies.
const NORMATIVE_PHRASES = [
  'must not',
  'may not',
  'shall not',
  'is required',
  'are required',
  'no later than',
  'prior to',
  'at minimum',
  'at least',
  'sole purpose',
  'must',
  'shall',
]

const STEP_RE = /^\s*(?:step\s*)?(\d+)[.):]\s+\S/i
const HEADING_RE = /^[A-Z0-9][A-Z0-9 &/\-]{3,}$/
const AMOUNT_RE = /\$\s?[\d,]+(?:\.\d{2})?|\b\d+\s?(?:months?|days?|years?)\b/i
const DATE_RE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/
const VERSION_RE = /\bv(?:ersion)?\.?\s?\d+(?:\.\d+)*\b/i
const ENDPOINT_RE = /\b(GET|POST|PUT|PATCH|DELETE)\s+\/\S*/

function findNormativePhrase(line: string): string | undefined {
  const lower = line.toLowerCase()
  return NORMATIVE_PHRASES.find((phrase) => lower.includes(phrase))
}

/** A short, Title Case line with no sentence-ending punctuation reads as a field label. */
function looksLikeField(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || /[.!?]$/.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  if (words.length === 0 || words.length > 6) return false
  return words.every((w) => /^[A-Z][a-zA-Z0-9'&-]*$/.test(w) || /^[A-Z]+$/.test(w))
}

export function classifyLines(lines: string[], ref: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const raw of lines) {
    const text = raw.trim()
    if (text.length === 0) continue
    if (seen.has(text)) continue // repeated header/footer: keep only the first occurrence

    const normative = findNormativePhrase(text)
    if (normative) {
      candidates.push({ kind: 'rule', text, ref, because: `normative language: "${normative}"` })
      seen.add(text)
      continue
    }
    if (ENDPOINT_RE.test(text)) {
      candidates.push({ kind: 'endpoint', text, ref, because: 'matches METHOD /path' })
      seen.add(text)
      continue
    }
    if (STEP_RE.test(text)) {
      candidates.push({ kind: 'step', text, ref, because: 'numbered line' })
      seen.add(text)
      continue
    }
    if (VERSION_RE.test(text)) {
      candidates.push({ kind: 'version', text, ref, because: 'version token' })
      seen.add(text)
      continue
    }
    if (DATE_RE.test(text)) {
      candidates.push({ kind: 'date', text, ref, because: 'date-like token' })
      seen.add(text)
      continue
    }
    if (AMOUNT_RE.test(text)) {
      candidates.push({ kind: 'amount', text, ref, because: 'quantity/amount token' })
      seen.add(text)
      continue
    }
    if (HEADING_RE.test(text) && text === text.toUpperCase()) {
      candidates.push({ kind: 'heading', text, ref, because: 'line in capitals' })
      seen.add(text)
      continue
    }
    if (looksLikeField(text)) {
      candidates.push({ kind: 'field', text, ref, because: 'short Title Case line, no sentence punctuation' })
      seen.add(text)
      continue
    }
    // Section 7A: no normative language, no other structural match — this
    // line is a genuine miss for the deterministic classifier, not an error.
    seen.add(text)
  }

  return candidates
}
