import type { Candidate, Profile } from './profiles/types.js'
import { findContradictions, type Contradiction } from './contradictions.js'

// See ../Spec-Ingest-Tool.md section 9 (the corpus and the gap list) and
// section 9A (where the sources disagree).

export interface MergedCandidate extends Candidate {
  /** Every source that produced this exact (kind, text) pair — a line found
   *  in two sources gains a second source, not a second entry. */
  sources: string[]
}

export interface Corpus {
  candidates: Candidate[]
  merged: MergedCandidate[]
  contradictions: Contradiction[]
}

export interface CoverageReport {
  section: string
  title: string
  count: number
  unreachable: boolean
}

export function mergeCandidates(candidates: Candidate[]): Corpus {
  const byKey = new Map<string, MergedCandidate>()
  for (const c of candidates) {
    const key = `${c.kind}\u0000${c.text}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.sources.includes(c.ref)) existing.sources.push(c.ref)
    } else {
      byKey.set(key, { ...c, sources: [c.ref] })
    }
  }
  const merged = [...byKey.values()]
  return { candidates, merged, contradictions: findContradictions(candidates) }
}

export function scoreCoverage(
  corpus: Corpus,
  profile: Profile,
  sourceKinds: ReadonlySet<'document' | 'recording'> = new Set(['document', 'recording']),
): CoverageReport[] {
  return profile.sections.map((s) => {
    const count = corpus.merged.filter((c) => s.kinds.includes(c.kind)).length
    // Unreachable: no source of a kind that could ever fill this section
    // has been added this run — the gap list's most useful distinction
    // (see section 9), because it stops someone recording a fifth session
    // trying to close a section only a document can ever fill.
    const unreachable = count === 0 && !s.from.some((kind) => sourceKinds.has(kind))
    return { section: s.section, title: s.title, count, unreachable }
  })
}
