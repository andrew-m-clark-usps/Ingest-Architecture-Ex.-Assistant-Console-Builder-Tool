import { describe, expect, it } from 'vitest'
import { classifyLines } from './specExtract.js'

describe('classifyLines', () => {
  it('classifies normative language as a rule, recording which phrase fired', () => {
    const [candidate] = classifyLines(['The vendor must submit reports quarterly.'], 'doc.txt#1')
    expect(candidate.kind).toBe('rule')
    expect(candidate.because).toContain('must')
    expect(candidate.text).toBe('The vendor must submit reports quarterly.')
  })

  it('classifies a numbered line as a step', () => {
    const [candidate] = classifyLines(['1. Open the application menu'], 'doc.txt#2')
    expect(candidate.kind).toBe('step')
  })

  it('classifies an all-caps line as a heading and dedupes repeats', () => {
    const candidates = classifyLines(['SECTION OVERVIEW', 'some body text here', 'SECTION OVERVIEW'], 'doc.txt#3')
    const headings = candidates.filter((c) => c.kind === 'heading')
    expect(headings).toHaveLength(1)
  })

  it('classifies a short title-case line with no punctuation as a field', () => {
    const [candidate] = classifyLines(['Account Number'], 'doc.txt#4')
    expect(candidate.kind).toBe('field')
  })

  it('classifies a dollar amount as an amount', () => {
    const [candidate] = classifyLines(['The annual fee is $1,250.00 per licence.'], 'doc.txt#5')
    expect(candidate.kind).toBe('amount')
  })

  it('never rewrites the verbatim text of a candidate', () => {
    const line = 'must not be paraphrased, ever'
    const [candidate] = classifyLines([line], 'doc.txt#6')
    expect(candidate.text).toBe(line)
  })
})
