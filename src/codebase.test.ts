import { describe, expect, it } from 'vitest'
import { readCodebaseCandidates } from './codebase.js'

describe('readCodebaseCandidates', () => {
  it('extracts routes, fields, enum values, and config keys from source files', () => {
    const source = `
      interface CustomerRecord {
        crid: string
        zip5?: string
      }

      enum StatusCode {
        ACTIVE = 'ACTIVE',
        RETIRED = 'RETIRED',
      }

      router.get('/customers/:id', handler)
      axios.post('/audit/events', payload)

      const routes = [{ path: 'ledger' }]
      const key = process.env.API_BASE_URL
    `

    const candidates = readCodebaseCandidates(source, 'src/customer.ts')

    expect(candidates.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'GET /customers/:id')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'POST /audit/events')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'ROUTE /ledger')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'crid')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'zip5')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'field' && candidate.text === 'API_BASE_URL')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'state' && candidate.text === 'ACTIVE')).toBe(true)
    expect(candidates.some((candidate) => candidate.kind === 'state' && candidate.text === 'RETIRED')).toBe(true)
  })

  it('skips vendored or generated paths', () => {
    const source = `router.get('/ignored', handler)`

    expect(readCodebaseCandidates(source, 'node_modules/pkg/index.js')).toEqual([])
    expect(readCodebaseCandidates(source, 'dist/generated.js')).toEqual([])
  })
})