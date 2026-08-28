import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRecordedSession } from '../src/journalSpec.js'

async function makeSessionDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'session-'))
  const step1 = join(dir, 'step-1')
  await mkdir(step1, { recursive: true })
  await writeFile(
    join(step1, 'meta.json'),
    JSON.stringify({ route: '/change-of-address?session=abc123', title: 'Change of Address', state: 'loaded' }),
  )
  await writeFile(
    join(step1, 'fields.json'),
    JSON.stringify([{ name: 'businessName', type: 'text', required: true }]),
  )
  await writeFile(join(step1, 'ax-tree.json'), JSON.stringify([{ name: 'Business Name' }]))
  await writeFile(join(step1, 'styles.json'), JSON.stringify({ '--color-primary': '#333366' }))

  const step2 = join(dir, 'step-2-malformed')
  await mkdir(step2, { recursive: true })
  await writeFile(join(step2, 'meta.json'), '{ not valid json')

  return dir
}

test('drops the query string but keeps the route', async () => {
  const dir = await makeSessionDir()
  try {
    const candidates = await readRecordedSession(dir)
    const url = candidates.find((c) => c.kind === 'url')!
    assert.equal(url.text, '/change-of-address')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('only counts a state the step explicitly declares', async () => {
  const dir = await makeSessionDir()
  try {
    const candidates = await readRecordedSession(dir)
    const state = candidates.find((c) => c.kind === 'state')!
    assert.equal(state.text, 'loaded')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('reads field shapes and accessible names', async () => {
  const dir = await makeSessionDir()
  try {
    const candidates = await readRecordedSession(dir)
    const fields = candidates.filter((c) => c.kind === 'field')
    assert.ok(fields.some((f) => f.text.includes('businessName')))
    assert.ok(fields.some((f) => f.text === 'Business Name'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a malformed artifact does not fail the whole read', async () => {
  const dir = await makeSessionDir()
  try {
    const candidates = await readRecordedSession(dir)
    // step-2-malformed should be skipped, not throw, and step-1 still reads.
    assert.ok(candidates.length > 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a directory that does not exist returns no candidates rather than throwing', async () => {
  const candidates = await readRecordedSession(join(tmpdir(), 'does-not-exist-' + Date.now()))
  assert.deepEqual(candidates, [])
})
