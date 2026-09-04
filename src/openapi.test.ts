import { describe, expect, it } from 'vitest'
import { readOpenApiCandidates } from './openapi.js'

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('readOpenApiCandidates', () => {
  it('extracts endpoint, parameter, request-body, and schema-property candidates from an OpenAPI JSON spec', () => {
    const spec = bytes(
      JSON.stringify({
        openapi: '3.1.0',
        paths: {
          '/addresses/{id}': {
            get: {
              parameters: [{ name: 'id', in: 'path' }],
            },
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      properties: {
                        addressLine: { type: 'string' },
                        zip5: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            AddressRecord: {
              properties: {
                crid: { type: 'string' },
                state: { type: 'string' },
              },
            },
          },
        },
      }),
    )

    const candidates = readOpenApiCandidates(spec, 'openapi.json')

    expect(candidates).toBeDefined()
    expect(candidates?.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'GET /addresses/{id}')).toBe(true)
    expect(candidates?.some((candidate) => candidate.kind === 'endpoint' && candidate.text === 'POST /addresses/{id}')).toBe(true)
    expect(candidates?.some((candidate) => candidate.kind === 'field' && candidate.text === 'id')).toBe(true)
    expect(candidates?.some((candidate) => candidate.kind === 'field' && candidate.text === 'addressLine')).toBe(true)
    expect(candidates?.some((candidate) => candidate.kind === 'field' && candidate.text === 'crid')).toBe(true)
    expect(candidates?.some((candidate) => candidate.ref.includes('~1addresses~1{id}/get'))).toBe(true)
  })

  it('returns undefined for ordinary JSON that is not an OpenAPI spec', () => {
    const candidates = readOpenApiCandidates(bytes('{"name":"not-an-openapi-doc"}'), 'plain.json')
    expect(candidates).toBeUndefined()
  })
})