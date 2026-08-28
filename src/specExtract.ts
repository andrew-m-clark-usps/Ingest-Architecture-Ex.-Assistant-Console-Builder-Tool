import type { Candidate } from './profiles/types.js'

// DEMO/REFERENCE SCAFFOLD — see Spec-Ingest-Tool.md section 7 (classifying
// lines into candidates by normative language, numbering, and casing).
// This stub does none of that classification yet.
export function classifyLines(lines: string[], ref: string): Candidate[] {
  return lines
    .filter((l) => l.trim().length > 0)
    .map((text) => ({
      kind: 'heading',
      text,
      ref,
      because: 'demo scaffold: no real classification yet',
    }))
}
