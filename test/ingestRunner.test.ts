import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ingestPaths } from '../ingestRunner.mjs'

// ingestRunner.mjs is the shell-level module shared by cli.mjs and
// ui/server.mjs — the sniff-and-read loop lives here exactly once so the
// two shells (terminal, browser) can never disagree about what counts as
// "read" vs. "skipped" vs. "refused". This exercises it against real files
// on disk, the same way cli.mjs is smoke-tested, rather than only against
// each reader in isolation.

async function makeFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ingest-runner-'))
  await writeFile(join(dir, 'notes.txt'), 'This is a plain prose note, not any format this scaffold reads.')
  await mkdir(join(dir, 'app', 'routes'), { recursive: true })
  await writeFile(join(dir, 'app', 'routes', 'addresses.ts'), "router.get('/addresses/:id', handler)")
  return dir
}

test('ingestPaths reports a missing path, an unrecognized file, and a real codebase directory', async () => {
  const dir = await makeFixture()
  try {
    const { fileReports, corpus, coverage } = await ingestPaths([
      join(dir, 'does-not-exist.pdf'),
      join(dir, 'notes.txt'),
      join(dir, 'app'),
    ])

    assert.equal(fileReports.length, 3)

    const missing = fileReports.find((r) => r.path.endsWith('does-not-exist.pdf'))
    assert.equal(missing?.status, 'missing')

    const notes = fileReports.find((r) => r.path.endsWith('notes.txt'))
    assert.equal(notes?.status, 'skipped')
    assert.equal(notes?.detail, 'unrecognized content')

    const codebase = fileReports.find((r) => r.path.endsWith('app'))
    assert.equal(codebase?.status, 'read')
    assert.match(codebase?.detail ?? '', /codebase, \d+ file\(s\)/)

    assert.ok(Array.isArray(corpus.candidates))
    assert.ok(corpus.candidates.some((c) => c.kind === 'endpoint'))
    assert.ok(Array.isArray(coverage))
    assert.equal(coverage.length, 8)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
