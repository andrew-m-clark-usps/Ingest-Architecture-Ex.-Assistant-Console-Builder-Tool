// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 8.
// Types only; no runtime logic.

export type CandidateKind =
  | 'rule'
  | 'step'
  | 'field'
  | 'heading'
  | 'amount'
  | 'date'
  | 'version'
  | 'endpoint'
  | 'state'
  | 'record'
  | 'style'
  | 'url'

export interface Candidate {
  kind: CandidateKind
  text: string
  ref: string
  because: string
}

export interface SectionTarget {
  section: string
  title: string
  kinds: CandidateKind[]
  from: ('document' | 'recording')[]
  fill: string
}

export interface Profile {
  id: string
  name: string
  description: string
  sections: SectionTarget[]
  synonyms?: Record<string, string>
  sensitiveKeys?: string[]
}

// See ../../Spec-Ingest-Tool.md section 8: "Validate a supplied profile
// loudly and before anything is read: reject one with no sections, and
// reject a section listing no source kinds." Either omission would
// otherwise surface as an empty coverage report, which reads exactly like
// "these documents contained nothing."
export function validateProfile(profile: Profile): void {
  if (!profile.sections || profile.sections.length === 0) {
    throw new Error(`profile "${profile.id}" has no sections — a profile must declare at least one`)
  }
  for (const section of profile.sections) {
    if (!section.kinds || section.kinds.length === 0) {
      throw new Error(
        `profile "${profile.id}" section "${section.section}" (${section.title}) lists no source kinds`,
      )
    }
    if (!section.from || section.from.length === 0) {
      throw new Error(
        `profile "${profile.id}" section "${section.section}" (${section.title}) declares no "from" (document/recording)`,
      )
    }
  }
}
