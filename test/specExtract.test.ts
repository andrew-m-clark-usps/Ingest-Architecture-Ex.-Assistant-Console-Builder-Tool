import { test } from 'vitest'
import assert from 'node:assert/strict'
import { classifyLines } from '../src/specExtract.js'

test('a line with normative language is classified as a rule', () => {
  const [c] = classifyLines(['The form must be retained for 36 months.'], 'doc.pdf')
  assert.equal(c.kind, 'rule')
  assert.match(c.because, /must/)
})

test('a numbered line is a step', () => {
  const [c] = classifyLines(['1. Submit the completed form.'], 'doc.pdf')
  assert.equal(c.kind, 'step')
})

test('a short Title Case line with no sentence punctuation is a field', () => {
  const [c] = classifyLines(['Business Name'], 'doc.pdf')
  assert.equal(c.kind, 'field')
})

test('a line in capitals is a heading', () => {
  const [c] = classifyLines(['CHANGE OF ADDRESS'], 'doc.pdf')
  assert.equal(c.kind, 'heading')
})

test('repeated lines are deduplicated to one candidate', () => {
  const candidates = classifyLines(['Business Name', 'Business Name', 'Business Name'], 'doc.pdf')
  assert.equal(candidates.length, 1)
})

test('an empty document yields an honest zero, not an error', () => {
  assert.deepEqual(classifyLines([], 'doc.pdf'), [])
  assert.deepEqual(classifyLines(['   ', ''], 'doc.pdf'), [])
})

test('a plain sentence with no structural signal is walked past, not misclassified', () => {
  const candidates = classifyLines(['the quick brown fox jumps over the lazy dog and keeps going'], 'doc.pdf')
  assert.equal(candidates.length, 0)
})
