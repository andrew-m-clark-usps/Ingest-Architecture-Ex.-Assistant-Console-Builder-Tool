import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { buildRecordedSessionInventory, readRecordedSession } from './journalSpec.js'

const execFileAsync = promisify(execFile)

async function buildCli() {
  await execFileAsync('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'])
}

describe('readRecordedSession', () => {
  it('returns candidates from meta/fields/ax-tree/styles, stripping the query string from the route', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ route: '/gateway?tab=usage', title: 'Gateway' }))
      await writeFile(join(dir, 'fields.json'), JSON.stringify([{ label: 'Account Number' }, { name: 'crid' }]))
      await writeFile(join(dir, 'ax-tree.json'), JSON.stringify([{ name: 'Submit', role: 'button' }]))
      await writeFile(join(dir, 'styles.json'), JSON.stringify({ 'color-primary': '#333366' }))

      const candidates = await readRecordedSession(dir)

      expect(candidates.some((c) => c.kind === 'state' && c.text.includes('/gateway'))).toBe(true)
      expect(candidates.some((c) => c.kind === 'state' && c.text.includes('?'))).toBe(false)
      expect(candidates.some((c) => c.kind === 'field' && c.text === 'Account Number')).toBe(true)
      expect(candidates.some((c) => c.kind === 'field' && c.text === 'crid')).toBe(true)
      expect(candidates.some((c) => c.kind === 'field' && c.text === 'Submit')).toBe(true)
      expect(candidates.some((c) => c.kind === 'style' && c.text.includes('#333366'))).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not fail the whole read when one artifact file is malformed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(join(dir, 'meta.json'), '{ not valid json')
      await writeFile(join(dir, 'fields.json'), JSON.stringify([{ label: 'Account Number' }]))

      const candidates = await readRecordedSession(dir)

      expect(candidates.some((c) => c.text === 'Account Number')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('returns an empty list for a directory that does not exist', async () => {
    const candidates = await readRecordedSession(join(tmpdir(), 'definitely-does-not-exist-12345'))
    expect(candidates).toEqual([])
  })

  it('extracts endpoint and body-shape candidates from requests.json without carrying values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(
        join(dir, 'requests.json'),
        JSON.stringify({
          requests: [
            {
              method: 'post',
              url: 'https://example.test/api/addresses/validate?id=123',
              requestBodyShape: { addressLine: 'string', zip5: 'string' },
              responseBodyShape: { returnCode: 'string', matched: 'boolean' },
            },
          ],
        }),
      )

      const candidates = await readRecordedSession(dir)

      expect(candidates.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'POST /api/addresses/validate')).toBe(true)
      expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'addressLine')).toBe(true)
      expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'returnCode')).toBe(true)
      expect(candidates.some((candidate) => candidate.text.includes('123'))).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('extracts endpoint and JSON body-shape candidates from har.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(
        join(dir, 'har.json'),
        JSON.stringify({
          log: {
            entries: [
              {
                request: {
                  method: 'GET',
                  url: 'https://example.test/api/customers?crid=123',
                },
                response: {
                  content: { shape: { customerId: 'number', status: 'string' } },
                },
              },
            ],
          },
        }),
      )

      const candidates = await readRecordedSession(dir)

      expect(candidates.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'GET /api/customers')).toBe(true)
      expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'customerId')).toBe(true)
      expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'status')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('builds an artifact inventory a test can inspect', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ route: '/gateway', title: 'Gateway' }))
      await writeFile(join(dir, 'styles.json'), JSON.stringify({ 'color-primary': '#333366' }))

      const inventory = await buildRecordedSessionInventory(dir)

      expect(inventory.refusalReasons).toEqual([])
      expect(inventory.artifacts.map((artifact) => artifact.kind)).toEqual(['meta', 'styles'])
      expect(inventory.artifacts.every((artifact) => artifact.byteCount > 0)).toBe(true)
      expect(inventory.artifacts.every((artifact) => artifact.contentHash.length === 64)).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses captured artifacts that include Authorization, cookie, or request-body values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await writeFile(
        join(dir, 'requests.json'),
        JSON.stringify({ headers: { Authorization: 'Bearer abcdefghijklmno', Cookie: 'sid=12345' }, postData: 'ssn=123-45-6789' }),
      )

      const inventory = await buildRecordedSessionInventory(dir)

      expect(inventory.refusalReasons).toHaveLength(1)
      expect(inventory.refusalReasons[0]).toContain('authorization')
      expect(inventory.refusalReasons[0]).toContain('cookie')
      expect(inventory.refusalReasons[0]).toContain('request body')
      await expect(readRecordedSession(dir)).rejects.toThrow(/captured artifact contains sensitive value/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('prints recorded-session inventory through the CLI', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await buildCli()
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ route: '/gateway', title: 'Gateway' }))

      const result = await execFileAsync('node', ['cli.mjs', dir, '--inventory'])
      const printed = JSON.parse(result.stdout) as Array<{ artifacts: Array<{ kind: string }> }>

      expect(printed).toHaveLength(1)
      expect(printed[0].artifacts[0].kind).toBe('meta')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a non-zero exit code for unsafe recorded-session inventory while still printing it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-'))
    try {
      await buildCli()
      await writeFile(join(dir, 'requests.json'), JSON.stringify({ headers: { authorization: 'Bearer abcdefghijklmno' } }))

      await expect(execFileAsync('node', ['cli.mjs', dir, '--inventory'])).rejects.toMatchObject({
        code: 1,
        stdout: expect.stringContaining('requests.json'),
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
