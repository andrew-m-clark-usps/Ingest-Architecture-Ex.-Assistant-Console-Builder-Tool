import { describe, expect, it } from 'vitest'
import { addLocation, requestAccess } from './bcgAccess'

describe('addLocation', () => {
  it('assigns a new CRID to a location added without one -- the duplicate-CRID trap is intentional', () => {
    const a = addLocation([], { address: '1 Main St' })
    const b = addLocation([a], { address: '2 Main St' })
    expect(a.crid).not.toBe(b.crid)
  })

  it('keeps a supplied CRID as-is', () => {
    const a = addLocation([], { address: '1 Main St', crid: 'CRID-EXISTING' })
    expect(a.crid).toBe('CRID-EXISTING')
  })
})

describe('requestAccess', () => {
  it('makes the first requester of a service at a location its BSA', () => {
    const req = requestAccess([], { userId: 'u1', service: 'EPS', locationId: 'LOC-1' })
    expect(req.role).toBe('BSA')
    expect(req.status).toBe('Pending')
  })

  it('makes a later requester for the same service+location a plain User once the first is Approved', () => {
    const first = { ...requestAccess([], { userId: 'u1', service: 'EPS', locationId: 'LOC-1' }), status: 'Approved' as const }
    const second = requestAccess([first], { userId: 'u2', service: 'EPS', locationId: 'LOC-1' })
    expect(second.role).toBe('User')
  })

  it('a request for a different service or location still becomes BSA', () => {
    const first = { ...requestAccess([], { userId: 'u1', service: 'EPS', locationId: 'LOC-1' }), status: 'Approved' as const }
    const second = requestAccess([first], { userId: 'u2', service: 'PermitMail', locationId: 'LOC-1' })
    expect(second.role).toBe('BSA')
  })

  it('an unadministered (still Pending) BSA request does not block a later requester from also being scored as BSA-eligible', () => {
    const first = requestAccess([], { userId: 'u1', service: 'EPS', locationId: 'LOC-1' }) // stays Pending
    const second = requestAccess([first], { userId: 'u2', service: 'EPS', locationId: 'LOC-1' })
    // Correct behavior per the brief: only an APPROVED request establishes
    // the BSA, so a second requester while the first is still pending is
    // also scored BSA-eligible rather than being silently blocked.
    expect(second.role).toBe('BSA')
    expect(second.status).toBe('Pending')
  })
})
