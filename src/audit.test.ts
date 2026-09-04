import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendAuditRecord, hashContent } from './audit.js'

describe('hashContent', () => {
  it('is deterministic for the same bytes', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'))
  })

  it('differs for different content', () => {
    expect(hashContent('hello')).not.toBe(hashContent('goodbye'))
  })
})

describe('appendAuditRecord', () => {
  it('appends one JSON-lines record per call, never the extracted content itself', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'audit-'))
    const logPath = join(dir, 'log', 'audit.jsonl')
    try {
      await appendAuditRecord(
        { who: 'test-user', read: { path: 'doc.pdf', contentHash: hashContent('secret content'), byteCount: 14 } },
        logPath,
      )
      await appendAuditRecord({ who: 'test-user', refusal: { reason: 'scanned document' } }, logPath)

      const text = await readFile(logPath, 'utf-8')
      const lines = text.trim().split('\n')
      expect(lines).toHaveLength(2)

      const first = JSON.parse(lines[0])
      expect(first.who).toBe('test-user')
      expect(first.read.byteCount).toBe(14)
      expect(JSON.stringify(first)).not.toContain('secret content')

      const second = JSON.parse(lines[1])
      expect(second.refusal.reason).toBe('scanned document')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
