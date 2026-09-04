// Shared profile and candidate types used by extraction, reconciliation,
// and generation flows. See Spec-Ingest-Tool.md section 8.

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
