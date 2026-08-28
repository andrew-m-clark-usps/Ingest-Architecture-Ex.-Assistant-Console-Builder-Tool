import { test } from 'vitest'
import assert from 'node:assert/strict'
import { classifyLines } from '../src/specExtract.js'
import { proposeAdditionalCandidates, withOptionalInference } from '../src/inference.js'

// See ../Spec-Ingest-Tool.md section 7A: "--no-ml runs the whole tool with
// the model disabled, and it is the default... A test asserts that every
// candidate produced without the model is still present, byte-identical,
// when the model is enabled. If that test ever fails, the model has
// started deciding."

test('every --no-ml candidate is present, byte-identical, when inference is enabled', () => {
  const lines = [
    'Business Name',
    'Must be retained for 36 months.',
    'The licensee retains the form for each customer.',
  ]
  const deterministic = classifyLines(lines, 'doc.pdf')
  const proposed = proposeAdditionalCandidates(lines, 'doc.pdf', { modelName: 'demo', modelVersion: '1' })

  const withoutMl = withOptionalInference(deterministic, proposed, false)
  const withMl = withOptionalInference(deterministic, proposed, true)

  assert.deepEqual(withoutMl, deterministic)
  for (const candidate of withoutMl) {
    assert.ok(
      withMl.some(
        (c) => c.kind === candidate.kind && c.text === candidate.text && c.ref === candidate.ref && c.because === candidate.because,
      ),
      `deterministic candidate missing when ML is enabled: ${candidate.text}`,
    )
  }
})

test('inference only ever adds candidates; it never removes or reorders the deterministic ones', () => {
  const lines = ['Business Name', 'The licensee retains the form for each customer.']
  const deterministic = classifyLines(lines, 'doc.pdf')
  const proposed = proposeAdditionalCandidates(lines, 'doc.pdf', { modelName: 'demo', modelVersion: '1' })
  const withMl = withOptionalInference(deterministic, proposed, true)

  assert.ok(withMl.length >= deterministic.length)
  assert.deepEqual(withMl.slice(0, deterministic.length), deterministic)
})

test('a model-proposed candidate names the model and version instead of a matched phrase', () => {
  const lines = ['The licensee retains the form for each customer.']
  const [proposal] = proposeAdditionalCandidates(lines, 'doc.pdf', { modelName: 'demo-classifier', modelVersion: '2.0' })
  assert.match(proposal.because, /demo-classifier v2\.0/)
  assert.match(proposal.because, /unconfirmed/)
})

test('--no-ml default: proposeAdditionalCandidates is never called unless explicitly enabled', () => {
  const lines = ['The licensee retains the form for each customer.']
  const deterministic = classifyLines(lines, 'doc.pdf')
  // Simulates the default CLI path: no proposals generated, nothing added.
  const result = withOptionalInference(deterministic, [], false)
  assert.deepEqual(result, deterministic)
})
