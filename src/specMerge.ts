import type { Candidate, Profile } from './profiles/types.js'

// See Spec-Ingest-Tool.md section 9 (the corpus and the gap list) and
// section 9a (where the sources disagree).

export interface MergedCandidate extends Candidate {
  refs: string[]
}

export interface Corpus {
  candidates: MergedCandidate[]
}

export interface CoverageReport {
  section: string
  title: string
  count: number
  unreachable: boolean
}

export interface Contradiction {
  a: Candidate
  b: Candidate
  because: string
}

// The same line read from two sources becomes ONE candidate carrying both
// provenance refs, not two separate candidates.
export function mergeCandidates(candidates: Candidate[]): Corpus {
  const byKey = new Map<string, MergedCandidate>()
  for (const c of candidates) {
    const key = `${c.kind}\u0000${c.text.trim()}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.refs.includes(c.ref)) existing.refs.push(c.ref)
    } else {
      byKey.set(key, { ...c, refs: [c.ref] })
    }
  }
  return { candidates: [...byKey.values()] }
}

export function scoreCoverage(corpus: Corpus, profile: Profile): CoverageReport[] {
  return profile.sections.map((s) => {
    const matching = corpus.candidates.filter((c) => s.kinds.includes(c.kind))
    // "Unreachable" reflects whether ANY source of a kind that could fill
    // this section has actually been supplied -- not a hardcoded false.
    const unreachable = matching.length === 0
    return { section: s.section, title: s.title, count: matching.length, unreachable }
  })
}

const AMOUNT_VALUE_RE = /\$\s?([\d,]+(?:\.\d{2})?)/
const VERSION_VALUE_RE = /\bv?(\d+\.\d+(?:\.\d+)?)\b/i
const SIGNIFICANT_WORD_RE = /\b[a-z]{4,}\b/gi

function significantWords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(SIGNIFICANT_WORD_RE) ?? []))
}

function sharesSignificantWords(a: string, b: string): boolean {
  const wa = significantWords(a)
  const wb = significantWords(b)
  for (const w of wa) if (wb.has(w)) return true
  return false
}

// Contradiction detection is a separate, explicit output -- not silently
// folded into merge. Two sources "disagree" when they describe the same
// thing (shared significant words) but assert a different amount/version.
export function detectContradictions(candidates: Candidate[]): Contradiction[] {
  const contradictions: Contradiction[] = []

  const amounts = candidates.filter((c) => c.kind === 'amount')
  for (let i = 0; i < amounts.length; i++) {
    for (let j = i + 1; j < amounts.length; j++) {
      const a = amounts[i]
      const b = amounts[j]
      if (a.ref === b.ref) continue
      const va = AMOUNT_VALUE_RE.exec(a.text)?.[1]?.replace(/,/g, '')
      const vb = AMOUNT_VALUE_RE.exec(b.text)?.[1]?.replace(/,/g, '')
      if (va && vb && va !== vb && sharesSignificantWords(a.text, b.text)) {
        contradictions.push({ a, b, because: `amounts differ: $${va} vs $${vb}` })
      }
    }
  }

  // Version tokens are scanned across every candidate, not only
  // version-kind lines -- a version number can appear inside a rule or a
  // heading. Amount-kind candidates are excluded from this scan: a
  // thousands-separated dollar figure like "$1,200.00" would otherwise
  // false-positive as a version token ("200.00") once the comma is
  // stripped by tokenization elsewhere.
  const withVersions = candidates
    .filter((c) => c.kind !== 'amount')
    .map((c) => ({ c, v: VERSION_VALUE_RE.exec(c.text)?.[1] }))
    .filter((x): x is { c: Candidate; v: string } => x.v !== undefined)
  for (let i = 0; i < withVersions.length; i++) {
    for (let j = i + 1; j < withVersions.length; j++) {
      const a = withVersions[i]
      const b = withVersions[j]
      if (a.c.ref === b.c.ref) continue
      if (a.v !== b.v && sharesSignificantWords(a.c.text, b.c.text)) {
        contradictions.push({ a: a.c, b: b.c, because: `version tokens differ: ${a.v} vs ${b.v}` })
      }
    }
  }

  return contradictions
}
