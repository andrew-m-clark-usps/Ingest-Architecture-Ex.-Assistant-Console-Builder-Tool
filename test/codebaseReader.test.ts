import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCodebase } from '../src/codebaseReader.js'

async function makeFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'codebase-'))

  await mkdir(join(dir, 'src', 'routes'), { recursive: true })
  await writeFile(
    join(dir, 'src', 'routes', 'addresses.ts'),
    [
      "app.post('/addresses/validate', handler)",
      "router.get('/addresses/:id', handler)",
      '// app.delete(\'/addresses/:id\', handler) -- disabled pending review',
      '// TODO: add rate limiting here',
      "const key = process.env.DATABASE_URL",
      "const apiKey = 'sk-not-a-real-key-but-shaped-like-one-123456'",
    ].join('\n'),
  )

  await writeFile(
    join(dir, 'src', 'model.ts'),
    [
      'enum AddressStatus { Pending, Approved, Rejected }',
      '@IsNotEmpty()',
      '@IsEmail()',
      'email: string',
    ].join('\n'),
  )

  await writeFile(
    join(dir, 'src', 'addresses.test.ts'),
    "test('rejects an empty business name', () => {})",
  )

  await mkdir(join(dir, 'migrations'), { recursive: true })
  await writeFile(
    join(dir, 'migrations', '001_init.sql'),
    'CREATE TABLE addresses (id INTEGER, business_name TEXT);',
  )

  // Vendored/generated content must be skipped entirely.
  await mkdir(join(dir, 'node_modules', 'some-lib'), { recursive: true })
  await writeFile(join(dir, 'node_modules', 'some-lib', 'index.ts'), "app.get('/should-not-appear', handler)")

  return dir
}

test('extracts route declarations from Express-style and decorator-style code', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    const endpoints = candidates.filter((c) => c.kind === 'endpoint')
    assert.ok(endpoints.some((c) => c.text === 'POST /addresses/validate'))
    assert.ok(endpoints.some((c) => c.text === 'GET /addresses/:id'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('extracts enum members and validation decorators as rules', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    const rules = candidates.filter((c) => c.kind === 'rule')
    assert.ok(rules.some((c) => c.text.includes('AddressStatus')))
    assert.ok(rules.some((c) => c.text.includes('IsNotEmpty')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('extracts test names and a SQL table with its columns', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    assert.ok(candidates.some((c) => c.kind === 'step' && c.text.includes('rejects an empty business name')))
    assert.ok(candidates.some((c) => c.kind === 'record' && c.text.includes('addresses') && c.text.includes('business_name')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('extracts a config key name only, never a credential value', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    const configCandidate = candidates.find((c) => c.text.includes('DATABASE_URL'))!
    assert.equal(configCandidate.text, 'config key: DATABASE_URL')
    const leaked = candidates.some((c) => c.text.includes('sk-not-a-real-key'))
    assert.equal(leaked, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('flags a TODO and commented-out code as a question, never a rule', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    const questions = candidates.filter((c) => c.text.startsWith('question:'))
    assert.ok(questions.some((c) => c.text.includes('rate limiting')))
    assert.ok(questions.some((c) => c.text.includes('commented-out')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('skips node_modules entirely', async () => {
  const dir = await makeFixture()
  try {
    const { candidates } = await readCodebase(dir)
    assert.equal(candidates.some((c) => c.text.includes('/should-not-appear')), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
