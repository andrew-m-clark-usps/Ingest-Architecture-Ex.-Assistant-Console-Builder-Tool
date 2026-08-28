import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mergeCandidates, scoreCoverage } from '../src/specMerge.js'
import { genericProfile } from '../src/profiles/generic.js'
import type { Candidate } from '../src/profiles/types.js'

test('a line found in two sources gains a second source, not a second entry', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'Must be retained for 36 months.', ref: 'a.pdf', because: 'normative' },
    { kind: 'rule', text: 'Must be retained for 36 months.', ref: 'b.pdf', because: 'normative' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.equal(corpus.merged.length, 1)
  assert.deepEqual(corpus.merged[0].sources.sort(), ['a.pdf', 'b.pdf'])
})

test('scoreCoverage counts merged candidates per section', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'Must do X.', ref: 'a.pdf', because: 'normative' },
  ]
  const corpus = mergeCandidates(candidates)
  const report = scoreCoverage(corpus, genericProfile)
  const rulesSection = report.find((r) => r.title === 'Rules')!
  assert.equal(rulesSection.count, 1)
})

test('an empty section from a document-only run is unreachable when only recordings were provided', () => {
  const corpus = mergeCandidates([])
  const report = scoreCoverage(corpus, genericProfile, new Set(['recording']))
  const rulesSection = report.find((r) => r.title === 'Rules')! // Rules: from: ['document'] only
  assert.equal(rulesSection.unreachable, true)
})

test('an empty section stays reachable while a matching source kind was provided', () => {
  const corpus = mergeCandidates([])
  const report = scoreCoverage(corpus, genericProfile, new Set(['document']))
  const rulesSection = report.find((r) => r.title === 'Rules')!
  assert.equal(rulesSection.unreachable, false)
})

test('detects a quantity contradiction between two sources citing different values for the same subject', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'The retention window is 48 months per the guide.', ref: 'guide.pdf', because: 'x' },
    { kind: 'rule', text: 'The retention window is 36 months per the schedule.', ref: 'schedule.pdf', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.ok(corpus.contradictions.some((c) => c.kind === 'quantity'))
})

test('does not flag a quantity mentioned consistently across sources', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'The retention window is 36 months per the guide.', ref: 'guide.pdf', because: 'x' },
    { kind: 'rule', text: 'The retention window is 36 months per the schedule.', ref: 'schedule.pdf', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.equal(corpus.contradictions.filter((c) => c.kind === 'quantity').length, 0)
})

test('does not flag quantities with different units as a contradiction', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'The retention window is 36 months per the guide.', ref: 'guide.pdf', because: 'x' },
    { kind: 'rule', text: 'The file size limit is 36 MB per the schedule.', ref: 'schedule.pdf', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.equal(corpus.contradictions.filter((c) => c.kind === 'quantity').length, 0)
})

test('detects a version contradiction for the same cited agreement', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'The service agreement version 2.1 applies.', ref: 'slide.pptx', because: 'x' },
    { kind: 'rule', text: 'The service agreement version 3.0 applies.', ref: 'contract.pdf', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.ok(corpus.contradictions.some((c) => c.kind === 'version'))
})

test('detects a requiredness contradiction for the same field label', () => {
  const candidates: Candidate[] = [
    { kind: 'field', text: 'Business Name is required.', ref: 'form.pdf', because: 'x' },
    { kind: 'field', text: 'Business Name is not required.', ref: 'schema.json', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.ok(corpus.contradictions.some((c) => c.kind === 'requiredness'))
})

test('a line carrying two quantities is skipped, not paired with anything', () => {
  const candidates: Candidate[] = [
    { kind: 'rule', text: 'Between 12 months and 36 months depending on tier.', ref: 'a.pdf', because: 'x' },
    { kind: 'rule', text: 'The retention window is 36 months.', ref: 'b.pdf', because: 'x' },
  ]
  const corpus = mergeCandidates(candidates)
  assert.equal(corpus.contradictions.filter((c) => c.kind === 'quantity').length, 0)
})
