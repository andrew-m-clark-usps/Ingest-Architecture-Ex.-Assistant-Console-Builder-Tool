import type { Candidate, CandidateKind } from './profiles/types.js'

// See Spec-Ingest-Tool.md section 7. Classifies each non-blank line into a
// candidate kind by normative language, numbering, and casing -- never by
// paraphrasing the line itself (the candidate's `text` is always verbatim,
// `because` records only which rule fired).

const NORMATIVE_PHRASES = [
  'must',
  'shall',
  'may not',
  'is required',
  'prior to',
  'at minimum',
  'at least',
  'no later than',
  'sole purpose',
]

const MONTH_YEAR_RE = /\b\d+\s*(?:month|months|year|years)\b/i
const STEP_RE = /^\s*(?:\d+[.)]|step\s+\d+\b)/i
const DATE_RE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/
const AMOUNT_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/
const VERSION_RE = /\bv?\d+\.\d+(?:\.\d+)?\b/i

function detectNormativePhrase(line: string): string | undefined {
  const lower = line.toLowerCase()
  for (const phrase of NORMATIVE_PHRASES) {
    if (lower.includes(phrase)) return phrase
  }
  if (MONTH_YEAR_RE.test(line)) return MONTH_YEAR_RE.exec(line)?.[0]
  return undefined
}

function isAllCapsHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, '')
  return letters.length >= 3 && letters === letters.toUpperCase()
}

function isFieldLabel(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > 48) return false
  if (/[.!?;]$/.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  if (words.length > 6) return false
  return words.every((w) => /^[A-Z][a-zA-Z0-9'()/-]*$/.test(w) || /^[A-Z0-9/#-]+$/.test(w))
}

export function classifyLines(lines: string[], ref: string): Candidate[] {
  const candidates: Candidate[] = []
  const seenHeadings = new Set<string>()

  for (const raw of lines) {
    const text = raw.trim()
    if (text.length === 0) continue

    const normativePhrase = detectNormativePhrase(text)
    if (normativePhrase) {
      candidates.push({ kind: 'rule', text, ref, because: `normative language: "${normativePhrase}"` })
      continue
    }
    if (STEP_RE.test(text)) {
      candidates.push({ kind: 'step', text, ref, because: 'numbered step' })
      continue
    }
    if (AMOUNT_RE.test(text)) {
      candidates.push({ kind: 'amount', text, ref, because: `matched amount pattern: "${AMOUNT_RE.exec(text)?.[0]}"` })
      continue
    }
    if (DATE_RE.test(text)) {
      candidates.push({ kind: 'date', text, ref, because: `matched date pattern: "${DATE_RE.exec(text)?.[0]}"` })
      continue
    }
    if (VERSION_RE.test(text)) {
      candidates.push({ kind: 'version', text, ref, because: `matched version pattern: "${VERSION_RE.exec(text)?.[0]}"` })
      continue
    }
    if (isAllCapsHeading(text)) {
      // Dedupe repeated headers (e.g. a running page header) -- keep only
      // the first occurrence and its provenance.
      if (seenHeadings.has(text)) continue
      seenHeadings.add(text)
      candidates.push({ kind: 'heading' as CandidateKind, text, ref, because: 'all-caps heading' })
      continue
    }
    if (isFieldLabel(text)) {
      candidates.push({ kind: 'field', text, ref, because: 'short title-case line, no sentence punctuation' })
      continue
    }
  }

  return candidates
}
