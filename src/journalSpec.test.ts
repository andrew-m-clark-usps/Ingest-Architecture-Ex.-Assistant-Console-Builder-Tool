import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRecordedSession } from './journalSpec.js'

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
})
