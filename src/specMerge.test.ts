import { describe, expect, it } from 'vitest'
import { mergeCandidates, scoreCoverage, detectContradictions } from './specMerge.js'
import { genericProfile } from './profiles/generic.js'
import type { Candidate } from './profiles/types.js'

describe('mergeCandidates', () => {
  it('merges the same line from two sources into one candidate with two provenance refs', () => {
    const candidates: Candidate[] = [
      { kind: 'rule', text: 'Reports are due monthly.', ref: 'deck.pptx#3', because: 'normative language: "must"' },
      { kind: 'rule', text: 'Reports are due monthly.', ref: 'manual.pdf#12', because: 'normative language: "must"' },
    ]
    const corpus = mergeCandidates(candidates)
    expect(corpus.candidates).toHaveLength(1)
    expect(corpus.candidates[0].refs.sort()).toEqual(['deck.pptx#3', 'manual.pdf#12'])
  })

  it('keeps distinct text as distinct candidates', () => {
    const candidates: Candidate[] = [
      { kind: 'field', text: 'Account Number', ref: 'a', because: '' },
      { kind: 'field', text: 'Customer Name', ref: 'b', because: '' },
    ]
    expect(mergeCandidates(candidates).candidates).toHaveLength(2)
  })
})

describe('scoreCoverage', () => {
  it('marks a section unreachable when no supplied candidate can fill it', () => {
    const corpus = mergeCandidates([{ kind: 'field', text: 'Account Number', ref: 'a', because: '' }])
    const coverage = scoreCoverage(corpus, genericProfile)
    const rules = coverage.find((c) => c.title === 'Rules')
    expect(rules?.unreachable).toBe(true)
    expect(rules?.count).toBe(0)
  })

  it('marks a section reachable once a matching-kind candidate exists', () => {
    const corpus = mergeCandidates([{ kind: 'rule', text: 'Must comply.', ref: 'a', because: 'must' }])
    const coverage = scoreCoverage(corpus, genericProfile)
    const rules = coverage.find((c) => c.title === 'Rules')
    expect(rules?.unreachable).toBe(false)
    expect(rules?.count).toBe(1)
  })
})

describe('detectContradictions', () => {
  it('flags two sources that disagree on an amount for the same thing', () => {
    const candidates: Candidate[] = [
      { kind: 'amount', text: 'The annual fee is $1,200.00', ref: 'a.pdf#1', because: '' },
      { kind: 'amount', text: 'The annual fee is $1,500.00', ref: 'b.pptx#4', because: '' },
    ]
    const contradictions = detectContradictions(candidates)
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0].because).toContain('1200')
    expect(contradictions[0].because).toContain('1500')
  })

  it('does not flag amounts about unrelated things', () => {
    const candidates: Candidate[] = [
      { kind: 'amount', text: 'The annual fee is $1,200.00', ref: 'a.pdf#1', because: '' },
      { kind: 'amount', text: 'The late penalty is $75.00', ref: 'b.pptx#4', because: '' },
    ]
    expect(detectContradictions(candidates)).toHaveLength(0)
  })

  it('flags version tokens found anywhere, not only version-kind lines', () => {
    const candidates: Candidate[] = [
      { kind: 'rule', text: 'The licence agreement version 2.1 applies.', ref: 'a', because: '' },
      { kind: 'heading', text: 'Licence agreement version 3.0', ref: 'b', because: '' },
    ]
    expect(detectContradictions(candidates)).toHaveLength(1)
  })
})
