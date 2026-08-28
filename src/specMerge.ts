import type { Candidate, Profile } from './profiles/types.js'

// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 9 (the corpus
// and the gap list) and section 9a (where the sources disagree).

export interface Corpus {
  candidates: Candidate[]
}

export interface CoverageReport {
  section: string
  title: string
  count: number
  unreachable: boolean
}

export function mergeCandidates(candidates: Candidate[]): Corpus {
  return { candidates }
}

export function scoreCoverage(corpus: Corpus, profile: Profile): CoverageReport[] {
  return profile.sections.map((s) => ({
    section: s.section,
    title: s.title,
    count: corpus.candidates.filter((c) => s.kinds.includes(c.kind)).length,
    unreachable: false,
  }))
}
