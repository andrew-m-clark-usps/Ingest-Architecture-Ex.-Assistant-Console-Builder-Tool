import { describe, expect, it } from 'vitest'
import { scanForCredentials } from './credentialScan.js'
import type { Candidate } from './profiles/types.js'

function candidate(text: string, ref = 'doc.txt#1'): Candidate {
  return { kind: 'rule', text, ref, because: '' }
}

describe('scanForCredentials', () => {
  it('flags a bearer token', () => {
    const findings = scanForCredentials([candidate('Authorization: Bearer abcdef1234567890')])
    expect(findings).toHaveLength(1)
    expect(findings[0].shape).toBe('bearer-token')
  })

  it('flags a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
    const findings = scanForCredentials([candidate(`token: ${jwt}`)])
    expect(findings.some((f) => f.shape === 'jwt')).toBe(true)
  })

  it('flags a private key header', () => {
    const findings = scanForCredentials([candidate('-----BEGIN RSA PRIVATE KEY-----')])
    expect(findings[0].shape).toBe('private-key-header')
  })

  it('flags a client_secret assignment', () => {
    const findings = scanForCredentials([candidate('client_secret=abc123XYZ')])
    expect(findings[0].shape).toBe('client-secret-assignment')
  })

  it('does not flag ordinary text', () => {
    expect(scanForCredentials([candidate('The vendor must submit reports quarterly.')])).toHaveLength(0)
  })

  it('carries the source ref so the refusal can name it', () => {
    const findings = scanForCredentials([candidate('Bearer abcdef1234567890', 'deck.pptx#slide3')])
    expect(findings[0].ref).toBe('deck.pptx#slide3')
  })
})
